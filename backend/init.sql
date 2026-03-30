CREATE TABLE IF NOT EXISTS provinces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS stations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  address TEXT NOT NULL,
  province_id INTEGER NOT NULL REFERENCES provinces(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_status (
  id SERIAL PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id),
  fuel_type TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  remaining_cars INTEGER DEFAULT NULL,
  UNIQUE(station_id, fuel_type)
);

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  station_id INTEGER REFERENCES stations(id),
  name TEXT NOT NULL,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS fuel_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  entity_name TEXT,
  details TEXT,
  user_type TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_type, user_id);

CREATE TABLE IF NOT EXISTS staff_station_requests (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  staff_name TEXT NOT NULL,
  station_id INTEGER NOT NULL REFERENCES stations(id),
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS station_requests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  address TEXT NOT NULL,
  province_id INTEGER NOT NULL REFERENCES provinces(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  phone TEXT,
  requested_by INTEGER NOT NULL REFERENCES staff(id),
  requested_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed all 77 provinces
INSERT INTO provinces (name) VALUES
  ('กรุงเทพมหานคร'),('กระบี่'),('กาญจนบุรี'),('กาฬสินธุ์'),('กำแพงเพชร'),
  ('ขอนแก่น'),('จันทบุรี'),('ฉะเชิงเทรา'),('ชลบุรี'),('ชัยนาท'),
  ('ชัยภูมิ'),('ชุมพร'),('เชียงราย'),('เชียงใหม่'),('ตรัง'),
  ('ตราด'),('ตาก'),('นครนายก'),('นครปฐม'),('นครพนม'),
  ('นครราชสีมา'),('นครศรีธรรมราช'),('นครสวรรค์'),('นนทบุรี'),('นราธิวาส'),
  ('น่าน'),('บึงกาฬ'),('บุรีรัมย์'),('ปทุมธานี'),('ประจวบคีรีขันธ์'),
  ('ปราจีนบุรี'),('ปัตตานี'),('พระนครศรีอยุธยา'),('พะเยา'),('พังงา'),
  ('พัทลุง'),('พิจิตร'),('พิษณุโลก'),('เพชรบุรี'),('เพชรบูรณ์'),
  ('แพร่'),('ภูเก็ต'),('มหาสารคาม'),('มุกดาหาร'),('แม่ฮ่องสอน'),
  ('ยโสธร'),('ยะลา'),('ร้อยเอ็ด'),('ระนอง'),('ระยอง'),
  ('ราชบุรี'),('ลพบุรี'),('ลำปาง'),('ลำพูน'),('เลย'),
  ('ศรีสะเกษ'),('สกลนคร'),('สงขลา'),('สตูล'),('สมุทรปราการ'),
  ('สมุทรสงคราม'),('สมุทรสาคร'),('สระแก้ว'),('สระบุรี'),('สิงห์บุรี'),
  ('สุโขทัย'),('สุพรรณบุรี'),('สุราษฎร์ธานี'),('สุรินทร์'),('หนองคาย'),
  ('หนองบัวลำภู'),('อ่างทอง'),('อำนาจเจริญ'),('อุดรธานี'),('อุตรดิตถ์'),
  ('อุทัยธานี'),('อุบลราชธานี');

-- Seed stations
INSERT INTO stations (name, brand, address, province_id, lat, lng, phone) VALUES
  ('ปั๊ม ปตท. สาขาลาดพร้าว', 'PTT', 'ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร', 1, 13.8159, 100.5617, '02-111-1111'),
  ('ปั๊ม เชลล์ สาขารัชดา', 'Shell', 'ถ.รัชดาภิเษก แขวงดินแดง เขตดินแดง', 1, 13.7648, 100.5580, '02-222-2222'),
  ('ปั๊ม บางจาก สาขาพระราม 9', 'Bangchak', 'ถ.พระราม 9 แขวงห้วยขวาง', 1, 13.7570, 100.5650, '02-333-3333'),
  ('ปั๊ม ปตท. สาขาแจ้งวัฒนะ', 'PTT', 'ถ.แจ้งวัฒนะ อ.ปากเกร็ด', 2, 13.8950, 100.5250, '02-444-4444'),
  ('ปั๊ม เชลล์ สาขาติวานนท์', 'Shell', 'ถ.ติวานนท์ อ.เมืองนนทบุรี', 2, 13.8600, 100.5100, '02-555-5555'),
  ('ปั๊ม ปตท. สาขาถนนมหิดล', 'PTT', 'ถ.มหิดล อ.เมืองเชียงใหม่', 4, 18.7700, 98.9800, '053-111-111'),
  ('ปั๊ม บางจาก สาขาสันทราย', 'Bangchak', 'อ.สันทราย จ.เชียงใหม่', 4, 18.8400, 98.9900, '053-222-222'),
  ('ปั๊ม คาลเท็กซ์ สาขาพัทยา', 'Caltex', 'ถ.สุขุมวิท อ.บางละมุง', 5, 12.9300, 100.8800, '038-111-111'),
  ('ปั๊ม ปตท. สาขาศรีราชา', 'PTT', 'อ.ศรีราชา จ.ชลบุรี', 5, 13.1700, 100.9300, '038-222-222'),
  ('ปั๊ม ปตท. สาขามิตรภาพ', 'PTT', 'ถ.มิตรภาพ อ.เมืองขอนแก่น', 6, 16.4300, 102.8300, '043-111-111');

-- Seed fuel types
INSERT INTO fuel_types (name, sort_order) VALUES
  ('ดีเซล', 1), ('ดีเซล B7', 2), ('แก๊สโซฮอล์ 91', 3),
  ('แก๊สโซฮอล์ 95', 4), ('แก๊สโซฮอล์ E20', 5), ('เบนซิน 95', 6),
  ('LPG', 7), ('NGV', 8), ('E85', 9)
ON CONFLICT (name) DO NOTHING;

-- Seed fuel status for all stations
DO $$
DECLARE
  s RECORD;
  fuels TEXT[] := ARRAY['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];
  f TEXT;
BEGIN
  FOR s IN SELECT id FROM stations LOOP
    FOREACH f IN ARRAY fuels LOOP
      INSERT INTO fuel_status (station_id, fuel_type, is_available, updated_by)
      VALUES (s.id, f, random() > 0.3, 'system');
    END LOOP;
  END LOOP;
END $$;

-- Admin table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed staff accounts (password: 1234)
INSERT INTO staff (username, password, station_id, name)
SELECT 'staff' || id, '1234', id, 'พนักงานปั๊ม ' || id FROM stations;

-- Seed admin account (username: admin, password: admin1234)
INSERT INTO admins (username, password, name) VALUES ('admin', 'admin1234', 'ผู้ดูแลระบบ');
