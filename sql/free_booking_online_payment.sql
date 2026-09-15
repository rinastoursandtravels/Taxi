-- ============================================================================
-- Allow a "pay later" booking to be paid online, and have it actually record.
--
-- RUN THIS AFTER sql/free_booking.sql (which must already be applied — this
-- function's new UPDATE clause references bookings.hold_expires_at).
--
-- Background: record_online_payment's ON CONFLICT branch previously updated
-- only txn_status / txn_id / gateway / payment_status on an existing payments
-- row — never amount_online_paid or payment_type. That was safe before free
-- booking existed, because the only way a payments row could already exist
-- was a duplicate webhook/verify retry for the SAME transaction, where those
-- two columns were already correct.
--
-- A free booking breaks that assumption: it pre-creates a payments row
-- (payment_type='cash', amount_online_paid=0, payment_status='unpaid') before
-- any money has moved. If that customer then pays online in full — exactly
-- the "pay within the hold window to guarantee your vehicle" flow — the old
-- function would mark the booking 'paid' while leaving amount_online_paid at
-- 0, silently erasing the captured amount from every revenue total.
--
-- This redefinition adds payment_type and amount_online_paid to the SET list,
-- guarded with the exact same "never touch a row that is already paid"
-- pattern the function already used for payment_status — so a confirmed,
-- fully-paid record can still never be downgraded or corrupted by a stale or
-- duplicate retry. It also clears hold_expires_at once a booking is
-- confirmed, so a paid booking never carries a stale hold value.
--
-- Everything else below is byte-for-byte identical to the version in
-- sql/payment_integrity.sql. Safe to run multiple times.
-- ============================================================================

CREATE OR REPLACE FUNCTION record_online_payment(
  p_booking_uuid    uuid,
  p_txn_id          text,
  p_order_id        text,
  p_captured_amount numeric,
  p_invoice         text DEFAULT NULL
)
RETURNS TABLE (payment_id uuid, was_created boolean, amount_mismatch boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking_id    uuid;       -- business key (bookings.booking_id)
  v_amount_total  numeric;
  v_payment_type  text;
  v_online_paid   numeric;
  v_payment_status text;
  v_expected      numeric;
  v_payment_id    uuid;
  v_existed       boolean := false;
  v_mismatch      boolean := false;
BEGIN
  -- Resolve the booking by its PK; fail loudly if it doesn't exist so the
  -- caller logs the anomaly instead of silently doing nothing.
  SELECT booking_id, amount_total
    INTO v_booking_id, v_amount_total
  FROM bookings
  WHERE id = p_booking_uuid;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'record_online_payment: booking % not found', p_booking_uuid;
  END IF;

  -- Derive payment type from what was actually captured (never trust the client).
  -- full  => captured covers the whole booking; partial => legacy 30% advance
  -- (new bookings can no longer reach this branch — create-order only ever
  -- requests 'full' — but it is kept so a retry against an old partial row
  -- still resolves consistently).
  IF p_captured_amount >= v_amount_total - 0.01 THEN
    v_payment_type   := 'full';
    v_payment_status := 'paid';
    v_expected       := v_amount_total;
  ELSE
    v_payment_type   := 'partial';
    v_payment_status := 'partial';
    v_expected       := round(v_amount_total * 0.3, 2);
  END IF;

  -- Never let amount_online_paid exceed the total (DB check_total_paid_valid).
  v_online_paid := least(p_captured_amount, v_amount_total);
  v_mismatch    := abs(p_captured_amount - v_expected) > 0.01;

  -- Upsert the payments row. booking_id is UNIQUE so a second call is a no-op
  -- update rather than a duplicate / constraint error.
  --
  -- payment_type and amount_online_paid are now part of the update, guarded
  -- identically to payment_status: once a row is 'paid', none of the three
  -- can ever move again. Before that point (pending / unpaid / partial), an
  -- incoming capture is free to promote the row — this is what lets a free
  -- ("pay later") booking convert to a real online payment.
  INSERT INTO payments (
    booking_id, payment_type, amount_total, amount_online_paid,
    amount_cash_paid, txn_status, txn_id, gateway, payment_status
  ) VALUES (
    v_booking_id, v_payment_type, v_amount_total, v_online_paid,
    0, 'success', p_txn_id, 'razorpay', v_payment_status
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    txn_status         = 'success',
    txn_id             = COALESCE(payments.txn_id, EXCLUDED.txn_id),
    gateway            = 'razorpay',
    payment_type       = CASE WHEN payments.payment_status = 'paid'
                              THEN payments.payment_type ELSE EXCLUDED.payment_type END,
    amount_online_paid = CASE WHEN payments.payment_status = 'paid'
                              THEN payments.amount_online_paid ELSE EXCLUDED.amount_online_paid END,
    payment_status     = CASE WHEN payments.payment_status = 'paid'
                              THEN payments.payment_status ELSE EXCLUDED.payment_status END
  RETURNING id, (xmax = 0) INTO v_payment_id, v_existed;
  -- (xmax = 0) is true when the row was freshly inserted by this statement.

  -- Ledger row for this online transaction. Idempotent on txn_id.
  INSERT INTO payment_records (
    payment_id, booking_id, txn_type, txn_id, gateway,
    amount, currency, status, razorpay_order_id, invoice_number
  ) VALUES (
    v_payment_id, v_booking_id::text, 'online', p_txn_id, 'razorpay',
    v_online_paid, 'INR', 'success', p_order_id, p_invoice
  )
  -- NOTE: the unique index on txn_id is PARTIAL (WHERE txn_id IS NOT NULL),
  -- so the ON CONFLICT arbiter MUST repeat that predicate or Postgres raises
  -- 42P10 "no unique or exclusion constraint matching the ON CONFLICT spec".
  ON CONFLICT (txn_id) WHERE txn_id IS NOT NULL DO NOTHING;

  -- Confirm the booking — but never resurrect a cancelled one. Clearing
  -- hold_expires_at means a booking paid online after being "pay later" never
  -- carries a stale hold value, matching what confirm-cash already does for
  -- the cash-settlement path.
  UPDATE bookings
     SET booking_status = 'confirmed',
         hold_expires_at = NULL
   WHERE id = p_booking_uuid
     AND booking_status <> 'cancelled';

  RETURN QUERY SELECT v_payment_id, v_existed, v_mismatch;
END;
$$;
