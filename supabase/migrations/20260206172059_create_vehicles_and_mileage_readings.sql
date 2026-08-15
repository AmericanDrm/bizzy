/*
  # Create Vehicles and Mileage Readings Tables

  1. New Tables
    - `vehicles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `organization_id` (uuid, references organizations)
      - `name` (text) - e.g. "2020 Ford F-150"
      - `make` (text, nullable)
      - `model` (text, nullable)
      - `year` (integer, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `mileage_readings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `organization_id` (uuid, references organizations)
      - `vehicle_id` (uuid, references vehicles)
      - `year` (integer) - the tax year
      - `start_reading` (numeric, nullable) - odometer on Jan 1
      - `end_reading` (numeric, nullable) - odometer on Dec 31
      - `personal_miles` (numeric, default 0) - personal miles to deduct
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated users to manage their own data

  3. Indexes
    - vehicle_id + year unique constraint on mileage_readings
    - user_id indexes on both tables
*/

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL DEFAULT '',
  make text,
  model text,
  year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_org_id ON vehicles(organization_id);

CREATE TABLE IF NOT EXISTS mileage_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid REFERENCES organizations(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  start_reading numeric,
  end_reading numeric,
  personal_miles numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id, year)
);

ALTER TABLE mileage_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mileage readings"
  ON mileage_readings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mileage readings"
  ON mileage_readings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mileage readings"
  ON mileage_readings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mileage readings"
  ON mileage_readings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mileage_readings_user_id ON mileage_readings(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_readings_vehicle_id ON mileage_readings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mileage_readings_year ON mileage_readings(year);

CREATE OR REPLACE TRIGGER trg_set_org_id
  BEFORE INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_organization_id();

CREATE OR REPLACE TRIGGER trg_set_org_id
  BEFORE INSERT ON mileage_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_organization_id();
