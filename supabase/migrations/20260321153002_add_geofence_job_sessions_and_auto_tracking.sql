/*
  # Geofence Job Sessions & Auto Time Tracking

  ## Overview
  Supports seamless geofence-based auto-tracking of job time for employees and
  stationary stop prompts with backdated job timers.

  ## New Tables

  ### geofence_job_sessions
  - Tracks when an employee enters/exits a client job site geofence
  - Stores auto-detected arrival and departure times
  - Links to time_entries, schedule_events, and clients
  - Supports per-user per-job multi-session tracking
  - manager_approved flag for oversight workflow

  ## Modified Tables

  ### time_entries
  - `auto_clock_in` (boolean): Was this entry created automatically by geofence
  - `auto_clock_out` (boolean): Was the clock-out set automatically by geofence

  ## Security
  - RLS enabled on geofence_job_sessions
  - Users can read/insert their own sessions
  - Admins/managers can view all org sessions (for oversight)
  - Users can update their own sessions
*/

-- ─── geofence_job_sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS geofence_job_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_entry_id       uuid REFERENCES time_entries(id) ON DELETE SET NULL,
  schedule_event_id   uuid REFERENCES schedule_events(id) ON DELETE SET NULL,
  client_id           uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_address_id   uuid REFERENCES client_addresses(id) ON DELETE SET NULL,
  client_name         text,

  -- Geofence arrival / departure
  arrived_at          timestamptz NOT NULL DEFAULT now(),
  departed_at         timestamptz,
  duration_minutes    integer GENERATED ALWAYS AS (
    CASE
      WHEN departed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (departed_at - arrived_at))::integer / 60
      ELSE NULL
    END
  ) STORED,

  -- Coordinates at arrival
  arrival_latitude    double precision,
  arrival_longitude   double precision,

  -- Auto-tracking state
  auto_tracked        boolean NOT NULL DEFAULT true,
  manager_approved    boolean NOT NULL DEFAULT false,
  manager_notes       text,
  approved_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at         timestamptz,

  -- Status: 'active' | 'completed' | 'discarded'
  status              text NOT NULL DEFAULT 'active',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE geofence_job_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see their own sessions
CREATE POLICY "Users can view own geofence sessions"
  ON geofence_job_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins/managers can view all org sessions
CREATE POLICY "Managers can view org geofence sessions"
  ON geofence_job_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = geofence_job_sessions.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('admin', 'manager')
    )
  );

-- Users can insert their own sessions
CREATE POLICY "Users can insert own geofence sessions"
  ON geofence_job_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own geofence sessions"
  ON geofence_job_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Managers can update any org session (for approval/oversight)
CREATE POLICY "Managers can update org geofence sessions"
  ON geofence_job_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = geofence_job_sessions.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = geofence_job_sessions.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('admin', 'manager')
    )
  );

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_user_id
  ON geofence_job_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_organization_id
  ON geofence_job_sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_time_entry_id
  ON geofence_job_sessions (time_entry_id);
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_client_id
  ON geofence_job_sessions (client_id);
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_arrived_at
  ON geofence_job_sessions (arrived_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_status
  ON geofence_job_sessions (status);

-- ─── time_entries: add auto clock-in/out flags ────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'auto_clock_in'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN auto_clock_in boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'auto_clock_out'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN auto_clock_out boolean DEFAULT false;
  END IF;
END $$;
