/*
  # Add time_entry_breaks table

  ## Summary
  Creates a direct time-entry-to-break relationship that doesn't require
  a productivity_session intermediary. This fixes the break tracking flow
  where breaks couldn't be saved because productivity_session creation
  could fail due to missing organization_id or RLS issues.

  ## New Tables
  - `time_entry_breaks`
    - `id` (uuid, primary key)
    - `time_entry_id` (uuid, FK to time_entries)
    - `user_id` (uuid, FK to auth.users)
    - `organization_id` (uuid, FK to organizations)
    - `started_at` (timestamptz, required)
    - `ended_at` (timestamptz, nullable — null means active break)
    - `notes` (text, optional)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/insert/update their own breaks within their org
  - Admins can read all breaks in their org
*/

CREATE TABLE IF NOT EXISTS time_entry_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_time_entry_id ON time_entry_breaks(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_user_id ON time_entry_breaks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_org_id ON time_entry_breaks(organization_id);

ALTER TABLE time_entry_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org breaks"
  ON time_entry_breaks FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = time_entry_breaks.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can insert own breaks"
  ON time_entry_breaks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own breaks"
  ON time_entry_breaks FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own breaks"
  ON time_entry_breaks FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
