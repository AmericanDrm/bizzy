/*
  # Add Detected Locations Table

  1. New Tables
    - `detected_locations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `time_entry_id` (uuid, references time_entries, nullable)
      - `latitude` (numeric) - detected location latitude
      - `longitude` (numeric) - detected location longitude
      - `first_detected_at` (timestamptz) - when first detected at this location
      - `last_detected_at` (timestamptz) - most recent detection
      - `visit_count` (integer) - how many times detected here
      - `total_minutes` (integer) - total time spent at this location
      - `address` (text, nullable) - reverse geocoded address
      - `associated_client_id` (uuid, references clients, nullable) - if user associates with existing client
      - `dismissed` (boolean) - if user dismisses this suggestion
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `detected_locations` table
    - Add policies for authenticated users to read/write their own detected locations

  3. Indexes
    - Index on user_id for fast queries
    - Index on associated_client_id
    - Index on dismissed status
    - Composite index on latitude/longitude for proximity searches
*/

CREATE TABLE IF NOT EXISTS detected_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE SET NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  first_detected_at timestamptz NOT NULL,
  last_detected_at timestamptz NOT NULL,
  visit_count integer DEFAULT 1 NOT NULL,
  total_minutes integer DEFAULT 0 NOT NULL,
  address text,
  associated_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  dismissed boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE detected_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own detected locations"
  ON detected_locations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own detected locations"
  ON detected_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own detected locations"
  ON detected_locations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own detected locations"
  ON detected_locations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_detected_locations_user_id ON detected_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_locations_client_id ON detected_locations(associated_client_id);
CREATE INDEX IF NOT EXISTS idx_detected_locations_dismissed ON detected_locations(dismissed);
CREATE INDEX IF NOT EXISTS idx_detected_locations_coords ON detected_locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_detected_locations_last_detected ON detected_locations(last_detected_at DESC);

CREATE OR REPLACE FUNCTION update_detected_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_detected_locations_updated_at
  BEFORE UPDATE ON detected_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_detected_locations_updated_at();
