/*
  # Create Oil Changes Table

  1. New Tables
    - `oil_changes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `organization_id` (uuid, references organizations)
      - `vehicle_id` (uuid, references vehicles, cascade delete)
      - `date` (date) - when the oil change was performed
      - `cost` (numeric, default 0) - how much it cost
      - `odometer` (numeric) - odometer reading at time of oil change
      - `notes` (text, nullable) - optional notes (oil type, shop name, etc.)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `oil_changes` table
    - Policies for authenticated users to manage their own data (select, insert, update, delete)

  3. Indexes
    - vehicle_id index for fast lookups per vehicle
    - user_id index
    - date index for ordering
*/

CREATE TABLE IF NOT EXISTS oil_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid REFERENCES organizations(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  cost numeric NOT NULL DEFAULT 0,
  odometer numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE oil_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own oil changes"
  ON oil_changes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own oil changes"
  ON oil_changes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own oil changes"
  ON oil_changes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own oil changes"
  ON oil_changes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_oil_changes_user_id ON oil_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_oil_changes_vehicle_id ON oil_changes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_oil_changes_date ON oil_changes(date);

CREATE OR REPLACE TRIGGER enforce_org_id_trigger
  BEFORE INSERT ON oil_changes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_user_organization_id();
