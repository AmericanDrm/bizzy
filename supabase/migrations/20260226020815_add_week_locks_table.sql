/*
  # Add Week Locks Table

  ## Purpose
  Allows payroll officers (admins/managers) to lock a specific week for a specific
  employee so no further edits can be made to that week's time entries.

  ## New Tables
  - `time_entry_week_locks`
    - `id` (uuid, primary key)
    - `organization_id` (uuid, FK to organizations)
    - `user_id` (uuid, the employee whose week is locked)
    - `week_start` (date, the Monday/start of the locked week)
    - `locked_by` (uuid, the admin who locked it)
    - `locked_at` (timestamptz)
    - `notes` (text, optional payroll note)

  ## Security
  - RLS enabled
  - Only admins/managers can create and delete locks
  - All org members can read locks (so they know their week is locked)

  ## Notes
  - Unique constraint on (organization_id, user_id, week_start) prevents duplicate locks
*/

CREATE TABLE IF NOT EXISTS time_entry_week_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  locked_by uuid NOT NULL REFERENCES auth.users(id),
  locked_at timestamptz DEFAULT now(),
  notes text DEFAULT '',
  UNIQUE(organization_id, user_id, week_start)
);

ALTER TABLE time_entry_week_locks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_week_locks_org ON time_entry_week_locks(organization_id);
CREATE INDEX IF NOT EXISTS idx_week_locks_user ON time_entry_week_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_week_locks_org_user ON time_entry_week_locks(organization_id, user_id);

CREATE POLICY "Members can view week locks for their org"
  ON time_entry_week_locks FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can create week locks"
  ON time_entry_week_locks FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
    AND locked_by = auth.uid()
  );

CREATE POLICY "Managers can delete week locks"
  ON time_entry_week_locks FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );
