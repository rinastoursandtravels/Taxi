-- ============================================================================
-- Payment integrity: one atomic, idempotent write path for online payments.
--
-- Used by /api/payment/verify, /api/payment/webhook and /api/admin/reconcile-payments.
-- Guarantees a captured payment can never end up unrecorded, and a booking can
-- never be confirmed without its payment row existing — both happen together,
-- inside one transaction, or not at all.
--
-- Safe to run multiple times (idempotent DDL).
-- ============================================================================

-- Idempotency for payment_records: at most one online row per Razorpay txn.
-- (payments.booking_id is already UNIQUE, giving idempotency for the payments row.)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_records_txn_id
  ON payment_records (txn_id)
  WHERE txn_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- record_online_payment
--   p_booking_uuid    : bookings.id (the PK — what Razorpay order notes carry)
--   p_txn_id          : Razorpay payment id (pay_...)
--   p_order_id        : Razorpay order id (order_...)
--   p_captured_amount : amount actually captured by Razorpay, in rupees
--   p_invoice         : invoice number to stamp on the payment_records row
--
-- Returns one row:
--   payment_id      uuid    -- payments.id (new or existing)
--   was_created     boolean -- true if the payments row was created by this call
--   amount_mismatch boolean -- true if captured <> expected for the derived type
-- ----------------------------------------------------------------------------
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
  -- full  => captured covers the whole booking; partial => 30% advance.
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
  INSERT INTO payments (
    booking_id, payment_type, amount_total, amount_online_paid,
    amount_cash_paid, txn_status, txn_id, gateway, payment_status
  ) VALUES (
    v_booking_id, v_payment_type, v_amount_total, v_online_paid,
    0, 'success', p_txn_id, 'razorpay', v_payment_status
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    txn_status     = 'success',
    txn_id         = COALESCE(payments.txn_id, EXCLUDED.txn_id),
    gateway        = 'razorpay',
    payment_status = CASE WHEN payments.payment_status = 'paid'
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

  -- Confirm the booking — but never resurrect a cancelled one.
  UPDATE bookings
     SET booking_status = 'confirmed'
   WHERE id = p_booking_uuid
     AND booking_status <> 'cancelled';

  RETURN QUERY SELECT v_payment_id, v_existed, v_mismatch;
END;
$$;
