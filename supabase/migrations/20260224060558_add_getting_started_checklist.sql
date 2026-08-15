/*
  # Add Getting Started Checklist Table

  ## Summary
  Creates a table to track onboarding/getting-started milestones for each organization.
  This powers the "Getting Started" checklist shown on the home dashboard for new users.

  ## New Tables
  - `getting_started_progress`
    - `id` (uuid, primary key)
    - `organization_id` (uuid, FK to organizations)
    - `step_id` (text) - identifier like 'add_first_client', 'create_invoice', etc.
    - `completed_at` (timestamptz) - when this step was completed
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Owners and managers can insert/update/delete
  - All org members can read

  ## Notes
  - Unique constraint on (organization_id, step_id) prevents duplicates
  - completed_at NULL means not yet completed
*/

CREATE TABLE IF NOT EXISTS getting_started_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, step_id)
);

ALTER TABLE getting_started_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view getting started progress"
  ON getting_started_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = getting_started_progress.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert getting started progress"
  ON getting_started_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = getting_started_progress.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can update getting started progress"
  ON getting_started_progress FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = getting_started_progress.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = getting_started_progress.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners can delete getting started progress"
  ON getting_started_progress FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = getting_started_progress.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'owner'
    )
  );

CREATE INDEX IF NOT EXISTS idx_getting_started_progress_org_id
  ON getting_started_progress(organization_id);
