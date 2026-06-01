CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name VARCHAR(255) NOT NULL,
  class VARCHAR(100) NOT NULL,
  number_plate VARCHAR(50) NOT NULL UNIQUE,
  capacity INT NOT NULL,
  driver_name VARCHAR(255) NOT NULL,
  driver_phone VARCHAR(20) NOT NULL,
  driver_email VARCHAR(255),
  driver_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cars (
  model_name,
  class,
  number_plate,
  capacity,
  driver_name,
  driver_phone,
  driver_email,
  driver_verified,
  is_active
) VALUES
  ('Swift Dzire', 'Economy', 'TR01AB1234', 4, 'Ramesh Das', '9876543210', 'ramesh@example.com', true, true),
  ('Honda Amaze', 'Economy', 'TR01CD5678', 4, 'Sanjay Paul', '9876543211', 'sanjay@example.com', true, true),
  ('Toyota Etios', 'Economy', 'TR04OP2233', 4, 'Deepak Nath', '9876543217', 'deepak@example.com', true, true),
  ('Toyota Innova', 'Premium', 'TR02EF1122', 6, 'Ajay Sharma', '9876543212', 'ajay@example.com', true, true),
  ('Toyota Innova', 'Premium', 'TR01EF1299', 6, 'Rony', '8999892202', 'aroy@example.com', true, true),
  ('Mahindra Xylo', 'Premium', 'TR02GH3344', 6, 'Bikash Deb', '9876543213', 'bikash@example.com', true, true),
  ('Innova Crysta', 'Luxury', 'TR03IJ5566', 7, 'Rahul Singh', '9876543214', 'rahul@example.com', true, true),
  ('Force Traveller', 'Group', 'TR04MN9900', 12, 'Kamal Roy', '9876543216', 'kamal@example.com', true, true),
  ('Maruti WagonR', 'Economy', 'TR03KL7788', 4, 'Manoj Saha', '9876543215', 'manoj@example.com', true, true);
