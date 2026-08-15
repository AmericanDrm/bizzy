/*
  # Add Break Policies and Break Type Tracking

  ## Summary
  This migration adds two things:
  1. A `break_policies` table so organizations can define named break types
     (e.g. "Lunch Break – 30 min", "Short Break – 15 min") with a duration in minutes.
  2. A `break_type_id` column on `time_entry_breaks` so each recorded break can be
     linked to a policy, enabling timed push-notification reminders when a break expires.

  ## New Tables
  - `break_policies`
    - `id` (uuid, PK)
    - `organization_id` (uuid, FK → organizations)
    - `name` (text) – e.g. "Lunch", "Short Break"
    - `duration_minutes` (int) – how long this break type lasts
    - `notify_on_expiry` (bool) – whether to fire a push notification when time is up
    - `color` (text) – optional display colour hex
    - `sort_order` (int) – display ordering
    - `created_at`, `updated_at`

  ## Modified Tables
  - `time_entry_breaks`
    - Added `break_type_id` (uuid, nullable FK → break_policies)

  ## Security
  - RLS enabled on `break_policies`
  - Org members can SELECT their org's policies
  - Admins/managers/owners can INSERT, UPDATE, DELETE

  ## Notes
  - Default break policies are NOT seeded here; orgs create their own.
  - `break_type_id` is nullable so existing breaks are unaffected.
*/

CREATE TABLE IF NOT EXISTS break_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 15,
  notify_on_expiry boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT '#4A90A4',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_break_policies_org_id ON break_policies(organization_id);

ALTER TABLE break_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view break policies"
  ON break_policies FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can insert break policies"
  ON break_policies FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update break policies"
  ON break_policies FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can delete break policies"
  ON break_policies FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

-- Add break_type_id to time_entry_breaks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entry_breaks' AND column_name = 'break_type_id'
  ) THEN
    ALTER TABLE time_entry_breaks
      ADD COLUMN break_type_id uuid REFERENCES break_policies(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_break_type_id ON time_entry_breaks(break_type_id);
