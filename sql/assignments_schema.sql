CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL,
    car_id UUID,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    car_model_snapshot TEXT,
    car_number_plate_snapshot TEXT,
    car_class_snapshot TEXT,
    driver_name_snapshot TEXT,
    driver_phone_snapshot TEXT,
    driver_email_snapshot TEXT,
    conflict_override BOOLEAN NOT NULL DEFAULT false,
    conflict_override_reason TEXT,
    conflict_override_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_assignment_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(booking_id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_assignment_car
        FOREIGN KEY (car_id)
        REFERENCES cars(id)
        ON DELETE SET NULL,
    
    CONSTRAINT check_valid_datetime CHECK (end_datetime > start_datetime)
);

CREATE INDEX IF NOT EXISTS idx_assignments_booking_id ON vehicle_assignments(booking_id);
CREATE INDEX IF NOT EXISTS idx_assignments_car_id ON vehicle_assignments(car_id);
CREATE INDEX IF NOT EXISTS idx_assignments_datetime ON vehicle_assignments(start_datetime, end_datetime);

CREATE OR REPLACE FUNCTION validate_vehicle_assignment_conflict()
RETURNS trigger AS $$
DECLARE
  new_booking_status booking_status_enum;
BEGIN
  SELECT booking_status
  INTO new_booking_status
  FROM bookings
  WHERE booking_id = NEW.booking_id;

  IF NEW.car_id IS NULL
     OR NEW.conflict_override
     OR new_booking_status IS NULL
     OR new_booking_status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- Serialise same-car checks so two concurrent non-override inserts cannot
  -- both pass the overlap check before either transaction commits.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.car_id::text));

  IF EXISTS (
    SELECT 1
    FROM vehicle_assignments other
    JOIN bookings other_booking ON other_booking.booking_id = other.booking_id
    WHERE other.id <> NEW.id
      AND other.car_id = NEW.car_id
      AND other_booking.booking_status IN ('pending', 'confirmed')
      AND other.start_datetime < NEW.end_datetime
      AND other.end_datetime > NEW.start_datetime
  ) THEN
    RAISE EXCEPTION 'Overlapping active vehicle assignment for car %', NEW.car_id
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_vehicle_assignment_conflict
BEFORE INSERT OR UPDATE OF car_id, start_datetime, end_datetime, conflict_override
ON vehicle_assignments
FOR EACH ROW
EXECUTE FUNCTION validate_vehicle_assignment_conflict();




-- 1. Assigning the Airport Transfer (John Doe) to the Innova Crysta
INSERT INTO vehicle_assignments (
    booking_id,
    car_id,
    start_datetime,
    end_datetime
) 
SELECT 
    b.booking_id, 
    c.id, 
    b.start_datetime, 
    b.end_datetime
FROM bookings b, cars c
WHERE b.user_name = 'John Doe' 
  AND c.number_plate = 'TR03IJ5566' -- Innova Crysta
LIMIT 1;

-- 2. Assigning the Tour Package (Alice Wong) to the Toyota Alphard 
-- (Assuming Alphard was intended to be the Innova Crysta TR03IJ5566 or similar luxury)
INSERT INTO vehicle_assignments (
    booking_id,
    car_id,
    start_datetime,
    end_datetime
) 
SELECT 
    b.booking_id, 
    c.id, 
    b.start_datetime, 
    b.end_datetime
FROM bookings b, cars c
WHERE b.user_name = 'Alice Wong' 
  AND c.number_plate = 'TR04MN9900' -- Force Traveller (for the group tour)
LIMIT 1;
