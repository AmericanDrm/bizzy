/*
  Location Audit Logs for Context-Aware Time Tracking

  1. New Tables
    location_audit_logs
      id (uuid, primary key)
      organization_id (uuid, references organizations)
      user_id (uuid, references auth.users)
      time_entry_id (uuid, references time_entries, nullable)
      stop_id (text, unique hash of lat/lng + date)
      latitude (numeric)
      longitude (numeric)
      detected_at (timestamptz)
      stop_duration_minutes (integer)
      speed_mph (numeric, nullable)
      context_type (text) near_job, unknown_location, new_location
      prompt_shown (boolean)
      user_response (text, nullable) start_work, on_break, getting_supplies, stuck_in_traffic, add_job_site, dismiss
      related_client_id (uuid, references clients, nullable)
      related_schedule_id (uuid, references schedule_events, nullable)
      address (text, nullable)
      created_at (timestamptz)
      updated_at (timestamptz)

  2. Security
    Enable RLS on location_audit_logs table
    Add policies for authenticated users to manage their own logs
    Add policies for admin/manager to view all logs in their organization

  3. Indexes
    Index on stop_id for fast duplicate detection
    Index on user_id for user-specific queries
    Index on time_entry_id for session queries
    Index on detected_at for time-based queries
*/

CREATE TABLE IF NOT EXISTS location_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE SET NULL,
  stop_id text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  stop_duration_minutes integer NOT NULL DEFAULT 0,
  speed_mph numeric,
  context_type text NOT NULL CHECK (context_type IN ('near_job', 'unknown_location', 'new_location')),
  prompt_shown boolean NOT NULL DEFAULT false,
  user_response text CHECK (user_response IN ('start_work', 'on_break', 'getting_supplies', 'stuck_in_traffic', 'add_job_site', 'dismiss')),
  related_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  related_schedule_id uuid REFERENCES schedule_events(id) ON DELETE SET NULL,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_audit_logs_stop_id ON location_audit_logs(stop_id);
CREATE INDEX IF NOT EXISTS idx_location_audit_logs_user_id ON location_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_location_audit_logs_time_entry_id ON location_audit_logs(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_location_audit_logs_detected_at ON location_audit_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_location_audit_logs_org_id ON location_audit_logs(organization_id);

-- Enable RLS
ALTER TABLE location_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own audit logs
CREATE POLICY "Users can view own location audit logs"
  ON location_audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for users to insert their own audit logs
CREATE POLICY "Users can insert own location audit logs"
  ON location_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own audit logs
CREATE POLICY "Users can update own location audit logs"
  ON location_audit_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for admin/manager to view all logs in their organization
CREATE POLICY "Admins can view organization location audit logs"
  ON location_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = location_audit_logs.organization_id
      AND organization_members.role IN ('owner', 'admin', 'manager')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_location_audit_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_location_audit_logs_updated_at
  BEFORE UPDATE ON location_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_location_audit_logs_updated_at();