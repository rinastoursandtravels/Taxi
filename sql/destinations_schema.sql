CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  estimated_duration_minutes INTEGER NOT NULL CHECK (estimated_duration_minutes > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.destinations (
  name,
  description,
  estimated_duration_minutes,
  is_active
) VALUES
  ('Itanagar', 'Capital city of Arunachal Pradesh', 30, true),
  ('Naharlagun', 'Gateway town near Itanagar', 15, true),
  ('Ziro', 'Scenic valley famous for Apatani tribe', 240, true),
  ('Bomdila', 'Hill town with monasteries', 480, true),
  ('Dirang', 'Valley town near Tawang route', 420, true),
  ('Tawang', 'Famous for Tawang Monastery', 720, true),
  ('Pasighat', 'Oldest town of Arunachal', 300, true),
  ('Roing', 'Scenic town near Dibang Valley', 345, true),
  ('Tezu', 'Town in Lohit district', 420, true),
  ('Mechuka', 'Remote valley near Indo-China border', 840, true),
  ('Along (Aalo)', 'Town on the banks of Siyom river', 600, true),
  ('Seppa', 'East Kameng district HQ', 300, true),
  ('Changlang', 'Town near Myanmar border', 540, true),
  ('Khonsa', 'Tirap district HQ', 600, true),
  ('Daporijo', 'Upper Subansiri HQ', 540, true),
  ('Dispur', 'Major city and gateway to Northeast', 480, true),
  ('Tezpur', 'City on Brahmaputra river', 420, true),
  ('Dibrugarh', 'Tea city of India', 420, true),
  ('Jorhat', 'Cultural capital of Assam', 345, true),
  ('Silchar', 'Barak valley city', 840, true),
  ('Nagaon', 'Central Assam town', 420, true),
  ('Tinsukia', 'Industrial town in upper Assam', 480, true),
  ('Cherrapunji', 'One of the wettest places on Earth', 660, true),
  ('Dawki', 'Border town with crystal clear river', 720, true),
  ('Mawlynnong', 'Cleanest village in Asia', 720, true),
  ('Kohima', 'Capital of Nagaland', 600, true),
  ('Dimapur', 'Commercial hub of Nagaland', 540, true),
  ('Mon', 'Known for Konyak tribe', 840, true),
  ('Imphal', 'Capital of Manipur', 720, true),
  ('Bishnupur', 'Known for Loktak Lake', 780, true),
  ('Aizawl', 'Capital of Mizoram', 840, true),
  ('Lunglei', 'Second largest city in Mizoram', 900, true),
  ('Agartala', 'Capital of Tripura', 900, true),
  ('Udaipur (Tripura)', 'Temple town of Tripura', 960, true),
  ('Gangtok', 'Capital of Sikkim', 960, true),
  ('Namchi', 'South Sikkim town', 1020, true),
  ('Banderdewa', 'Entry point to Arunachal', 45, true),
  ('Ganga Lake', 'Popular tourist spot near Itanagar', 45, true),
  ('Hollongi Airport', 'Donyi Polo Airport', 10, true);



CREATE TABLE IF NOT EXISTS destination_car_fares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  model_name VARCHAR(255) NOT NULL,
  fixed_fare NUMERIC(10, 2) NOT NULL CHECK (fixed_fare > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_destination_car_model UNIQUE (destination_id, model_name)
);

CREATE INDEX IF NOT EXISTS idx_destination_car_fares_destination
  ON destination_car_fares(destination_id);

CREATE INDEX IF NOT EXISTS idx_destination_car_fares_model
  ON destination_car_fares(model_name);
