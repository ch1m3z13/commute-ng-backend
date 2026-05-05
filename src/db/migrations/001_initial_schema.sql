-- Migration: Initial Supabase schema (replaces Firestore)
-- Run this in your Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (replaces Firestore users/{uid})
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid TEXT NULL, -- temporary: for migration mapping from Firebase UIDs
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  mobile_number TEXT,
  nin TEXT,
  company TEXT,
  is_verified BOOLEAN DEFAULT false,
  rating DECIMAL(2,1) DEFAULT 5.0,
  role TEXT DEFAULT 'executive' CHECK (role IN ('executive', 'admin')),
  photo_url TEXT,
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  employment_letter_url TEXT,
  id_card_url TEXT,
  pay_stub_url TEXT,
  car_make TEXT,
  car_model TEXT,
  car_year TEXT,
  plate_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commutes table (replaces Firestore commutes/{id})
CREATE TABLE IF NOT EXISTS commutes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_uid UUID NOT NULL REFERENCES users(id),
  author_name TEXT,
  author_photo TEXT,
  start_point TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  seats_available INTEGER DEFAULT 1,
  car_make TEXT,
  car_model TEXT,
  car_year TEXT,
  plate_number TEXT,
  type TEXT DEFAULT 'offer' CHECK (type IN ('offer', 'request')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  shift TEXT CHECK (shift IN ('morning', 'evening')),
  recurring BOOLEAN DEFAULT false,
  days_of_week TEXT[],
  requests TEXT[], -- array of ride IDs requesting this commute
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rides table (replaces Firestore rides/{id})
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commute_id UUID NOT NULL REFERENCES commutes(id),
  driver_uid UUID NOT NULL REFERENCES users(id),
  passenger_uid UUID NOT NULL REFERENCES users(id),
  passenger_name TEXT,
  passenger_photo TEXT,
  author_name TEXT,
  author_photo TEXT,
  start_point TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  seats_available INTEGER DEFAULT 1,
  car_make TEXT,
  car_model TEXT,
  car_year TEXT,
  plate_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ride messages table (replaces rides/{id}/messages subcollection)
CREATE TABLE IF NOT EXISTS ride_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_uid UUID NOT NULL REFERENCES users(id),
  sender_name TEXT NOT NULL,
  sender_photo TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table (replaces users/{uid}/notifications/{id} subcollections)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_uid UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('ride_request', 'request_accepted', 'request_rejected', 'ride_reminder')),
  ride_id UUID REFERENCES rides(id),
  commute_id UUID REFERENCES commutes(id),
  actor_uid UUID NOT NULL REFERENCES users(id),
  actor_name TEXT NOT NULL,
  actor_photo TEXT,
  start_point TEXT,
  destination TEXT,
  departure_time TIMESTAMPTZ,
  read BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_commutes_author ON commutes(author_uid);
CREATE INDEX IF NOT EXISTS idx_commutes_type_status ON commutes(type, status);
CREATE INDEX IF NOT EXISTS idx_commutes_created ON commutes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_commute ON rides(commute_id);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON rides(passenger_uid);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_uid);
CREATE INDEX IF NOT EXISTS idx_rides_created ON rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_ride ON ride_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON ride_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_uid);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(recipient_uid, read);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE commutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users are readable by authenticated users" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for commutes
CREATE POLICY "Commutes are readable by authenticated users" ON commutes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authors can update own commutes" ON commutes
  FOR UPDATE USING (auth.uid() = author_uid OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated users can create commutes" ON commutes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authors can delete own commutes" ON commutes
  FOR DELETE USING (auth.uid() = author_uid OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for rides
CREATE POLICY "Participants can read rides" ON rides
  FOR SELECT USING (auth.uid() = driver_uid OR auth.uid() = passenger_uid OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Participants can update rides" ON rides
  FOR UPDATE USING (auth.uid() = driver_uid OR auth.uid() = passenger_uid OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated users can create rides" ON rides
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Participants can delete rides" ON rides
  FOR DELETE USING (auth.uid() = driver_uid OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for ride_messages
CREATE POLICY "Ride participants can read messages" ON ride_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_id
      AND (rides.driver_uid = auth.uid() OR rides.passenger_uid = auth.uid())
    )
  );

CREATE POLICY "Ride participants can insert messages" ON ride_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_uid AND
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_id
      AND (rides.driver_uid = auth.uid() OR rides.passenger_uid = auth.uid())
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = recipient_uid);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_uid);

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = recipient_uid);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- Service role key bypasses RLS, so no check needed

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commutes_updated_at ON commutes;
CREATE TRIGGER update_commutes_updated_at
  BEFORE UPDATE ON commutes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rides_updated_at ON rides;
CREATE TRIGGER update_rides_updated_at
  BEFORE UPDATE ON rides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
