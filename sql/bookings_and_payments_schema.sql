-- Fresh non-production reset for booking and payment objects.
DROP TABLE IF EXISTS payment_records CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;

DROP TYPE IF EXISTS payment_type_enum CASCADE;
DROP TYPE IF EXISTS booking_status_enum CASCADE;
DROP TYPE IF EXISTS booking_type_enum CASCADE;

-- Booking type
CREATE TYPE booking_type_enum AS ENUM ('taxi', 'tour');

-- Booking status
CREATE TYPE booking_status_enum AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- Payment type (user intent)
CREATE TYPE payment_type_enum AS ENUM ('partial', 'full');

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE,
  booking_type booking_type_enum NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  phone TEXT NOT NULL,
  passenger_count INTEGER NOT NULL CHECK (passenger_count > 0),
  start_datetime TIMESTAMP NOT NULL,
  end_datetime TIMESTAMP NOT NULL,
  destination_id UUID,
  tour_package_id UUID,
  car_model VARCHAR,
  amount_total NUMERIC(10,2) NOT NULL CHECK (amount_total >= 0),
  booking_status booking_status_enum DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancellation_requested_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  CONSTRAINT check_booking_datetime CHECK (end_datetime > start_datetime)
);

CREATE INDEX idx_bookings_active_model_window
  ON bookings(car_model, start_datetime, end_datetime)
  WHERE booking_status IN ('pending', 'confirmed');

CREATE INDEX idx_bookings_active_status_window
  ON bookings(booking_status, start_datetime, end_datetime)
  WHERE booking_status IN ('pending', 'confirmed');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('partial', 'full')),
  amount_total NUMERIC(10,2) NOT NULL CHECK (amount_total >= 0),
  amount_online_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_online_paid >= 0),
  txn_status TEXT DEFAULT 'pending' CHECK (txn_status IN ('pending', 'success', 'failed')),
  txn_id TEXT,
  gateway TEXT,
  amount_cash_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_cash_paid >= 0),
  cash_paid_at TIMESTAMP WITH TIME ZONE,
  cash_collected_by TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  refund_status TEXT DEFAULT 'none' CHECK (refund_status IN ('none', 'pending', 'processed', 'failed')),
  refund_amount NUMERIC(10,2) DEFAULT 0,
  refund_id TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_notes TEXT,
  CONSTRAINT check_total_paid_valid CHECK (
    amount_online_paid + amount_cash_paid <= amount_total
  ),
  CONSTRAINT check_full_payment_no_cash CHECK (
    payment_type != 'full' OR amount_cash_paid = 0
  ),
  CONSTRAINT fk_payment_booking
    FOREIGN KEY (booking_id)
    REFERENCES bookings(booking_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);

CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('online', 'cash')),
  txn_id TEXT,
  gateway TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  razorpay_order_id TEXT,
  collected_by TEXT,
  collected_at TIMESTAMPTZ,
  invoice_number TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. Taxi Booking
INSERT INTO bookings (
  booking_id,
  booking_type,
  user_name,
  user_email,
  phone,
  passenger_count,
  start_datetime,
  end_datetime,
  destination_id,
  car_model,
  amount_total,
  booking_status
) VALUES (
  uuid_generate_v4(),
  'taxi',
  'John Doe',
  'john.doe@example.com',
  '+15550102030',
  2,
  '2026-05-15 10:30:00',
  '2026-05-15 11:15:00',
  uuid_generate_v4(),
  'Tesla Model S',
  85.50,
  'confirmed'
);

-- 2. Tour Package Booking
INSERT INTO bookings (
  booking_id,
  booking_type,
  user_name,
  user_email,
  phone,
  passenger_count,
  start_datetime,
  end_datetime,
  tour_package_id,
  car_model,
  amount_total,
  booking_status
) VALUES (
  uuid_generate_v4(),
  'tour',
  'Alice Wong',
  'alice.w@traveler.net',
  '+442079460958',
  4,
  '2026-06-01 08:00:00',
  '2026-06-01 20:00:00',
  uuid_generate_v4(),
  'Toyota Alphard',
  550.00,
  'completed'
);
