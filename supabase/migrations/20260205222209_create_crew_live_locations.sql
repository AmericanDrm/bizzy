/*
  # Crew Live Locations Table

  Stores the most recent GPS position for each clocked-in user.
  Updated every time a location update is received (foreground or background).
  Used by admins to view real-time crew member positions.

  1. New Tables
    - `crew_live_locations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, unique)
      - `organization_id` (uuid, NOT NULL)
      - `latitude` (double precision)
      - `longitude` (double precision)
      - `accuracy` (double precision, nullable)
      - `speed` (double precision, default 0)
      - `status` (text, e.g. traveling, home_base, job_site, stopped, idle)
      - `time_entry_id` (uuid, nullable, the active time entry)
      - `client_name` (text, nullable, nearest client if at a job site)
      - `is_active` (boolean, default true, whether user is clocked in)
      - `last_updated` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Users can upsert their own location
    - Admins and managers in the same organization can view all locations
    - Policy uses organization_members to verify membership and role
*/

CREATE TABLE IF NOT EXISTS crew_live_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid NOT NULL,
  latitude double precision NOT NULL DEFAULT 0,
  longitude double precision NOT NULL DEFAULT 0,
  accuracy double precision,
  speed double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unknown',
  time_entry_id uuid,
  client_name text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE crew_live_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own live location"
  ON crew_live_locations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view org live locations"
  ON crew_live_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = crew_live_locations.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can insert own live location"
  ON crew_live_locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own live location"
  ON crew_live_locations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own live location"
  ON crew_live_locations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_crew_live_locations_org ON crew_live_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_crew_live_locations_active ON crew_live_locations(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_crew_live_locations_user ON crew_live_locations(user_id);
