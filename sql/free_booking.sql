-- ============================================================================
-- Free / unpaid booking support  (v4)
--
-- Removes the 30% advance requirement and lets customers submit a booking
-- without paying. Such bookings are recorded as UNPAID and followed up by the
-- Rina's team, who collect cash and record it in the dashboard.
--
-- SAFE TO RE-RUN. Run this in the Supabase SQL editor BEFORE deploying the v4
-- code — the cleanup cron and conflict engine both read bookings.payment_mode,
-- and will error until this migration exists.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. bookings: how the booking was placed, and how long it holds a vehicle
-- ---------------------------------------------------------------------------

-- 'online_full' = customer went to the payment screen (paid, or abandoned)
-- 'pay_later'   = customer deliberately submitted without paying
-- Existing rows default to 'online_full', which is correct: every booking made
-- before this migration went through the online flow.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'online_full';

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_mode_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_payment_mode_check
  CHECK (payment_mode IN ('online_full', 'pay_later'));

-- When the vehicle hold lapses for an unpaid booking. NULL = never expires,
-- which preserves today's behaviour for every existing booking.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

-- The cleanup cron filters on payment_mode; admin filters unpaid bookings.
CREATE INDEX IF NOT EXISTS idx_bookings_payment_mode_status
  ON bookings(payment_mode, booking_status);


-- ---------------------------------------------------------------------------
-- 2. payments: allow an unpaid, cash-settled payment row
-- ---------------------------------------------------------------------------
-- A free booking gets a payments row at creation time with 0 collected, so the
-- admin has something to record cash against (confirm-cash needs a payment_id).
--
-- Drop the old value-list CHECKs by definition rather than by name, so this
-- works regardless of how Postgres auto-named them.
--
-- The two business-rule constraints are excluded by name and left completely
-- untouched. That matters for check_full_payment_no_cash in particular: it
-- mentions payment_type, so a definition match alone would drop it.
--
-- Do NOT try to narrow this by matching on 'IN' — Postgres renders IN-lists as
-- "= ANY (ARRAY[...])", so the keyword is not present in the stored definition.

DO $$
DECLARE cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE rel.relname = 'payments'
       AND con.contype = 'c'
       AND con.conname NOT IN ('check_total_paid_valid', 'check_full_payment_no_cash')
       AND pg_get_constraintdef(con.oid) ILIKE '%payment_status%'
  LOOP
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'dropped payment_status constraint: %', cname;
  END LOOP;

  FOR cname IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE rel.relname = 'payments'
       AND con.contype = 'c'
       AND con.conname NOT IN ('check_total_paid_valid', 'check_full_payment_no_cash')
       AND pg_get_constraintdef(con.oid) ILIKE '%payment_type%'
  LOOP
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'dropped payment_type constraint: %', cname;
  END LOOP;
END $$;

-- 'unpaid' is new. 'partial' is retained for legacy 30% bookings that still
-- have cash outstanding — no new booking can enter 'partial'.
ALTER TABLE payments
  ADD CONSTRAINT payments_payment_status_check
  CHECK (payment_status IN ('pending', 'unpaid', 'partial', 'paid'));

-- 'cash' is new: settled offline, recorded by an admin. 'partial' is legacy.
ALTER TABLE payments
  ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type IN ('partial', 'full', 'cash'));


-- ---------------------------------------------------------------------------
-- 3. Settings (all admin-editable, no redeploy needed)
-- ---------------------------------------------------------------------------

INSERT INTO app_settings (key, value) VALUES
  -- Per-product kill switches. Independent by design: the team can keep free
  -- taxi bookings open while pausing free tour bookings, or vice versa. Both
  -- off = feature fully disabled. There is deliberately NO separate master
  -- switch, which would only create precedence confusion in the admin panel.
  ('free_booking_enabled_taxi',      'true'),
  ('free_booking_enabled_tour',      'true'),

  -- How long an unpaid booking holds its vehicle before releasing it to
  -- others. Always capped at the trip's own start time.
  ('free_booking_hold_hours_taxi',   '48'),
  ('free_booking_hold_hours_tour',   '24'),

  -- Minimum notice required to book for free. 0 = no restriction; a same-day
  -- or instant free booking is allowed.
  ('free_booking_min_lead_hours',    '0'),

  -- Abuse limits, keyed on the authenticated account (login is mandatory
  -- before checkout, so user_email is always present; phone is never verified).
  ('free_booking_max_open_per_user', '2'),
  ('free_booking_max_advance_days',  '90')
ON CONFLICT (key) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 4. Verify — all three should return the expected rows
-- ---------------------------------------------------------------------------
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'bookings'
--    AND column_name IN ('payment_mode', 'hold_expires_at');
--
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'payments'::regclass AND contype = 'c';
--
-- SELECT key, value FROM app_settings WHERE key LIKE 'free_booking%';
