/*
  # Create job_completion_notifications table

  ## Summary
  Stores an audit trail of every "job completed by employee" notification
  sent to org admins/owners when the employee lacks invoice creation permissions.

  ## New Tables
  - `job_completion_notifications`
    - `id` (uuid, PK)
    - `organization_id` (uuid, FK → organizations)
    - `schedule_event_id` (uuid, FK → schedule_events)
    - `employee_user_id` (uuid, FK → auth.users) — who completed the job
    - `employee_name` (text) — denormalized for display
    - `job_title` (text) — denormalized job name
    - `client_name` (text) — optional
    - `completed_at` (timestamptz) — when job was completed
    - `notes` (text) — optional employee note
    - `channels_attempted` (jsonb) — {email, sms, push}
    - `channels_succeeded` (jsonb) — which ones actually delivered
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled, members can insert for their own org
  - Admins/owners can select all for their org
*/

CREATE TABLE IF NOT EXISTS job_completion_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_event_id uuid REFERENCES schedule_events(id) ON DELETE SET NULL,
  employee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  completed_at timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL DEFAULT '',
  channels_attempted jsonb NOT NULL DEFAULT '{"email":false,"sms":false,"push":false}'::jsonb,
  channels_succeeded jsonb NOT NULL DEFAULT '{"email":false,"sms":false,"push":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_completion_notif_org ON job_completion_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_notif_employee ON job_completion_notifications(employee_user_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_notif_event ON job_completion_notifications(schedule_event_id);

ALTER TABLE job_completion_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can insert own org notifications"
  ON job_completion_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can view org notifications"
  ON job_completion_notifications FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Members can view own notifications"
  ON job_completion_notifications FOR SELECT
  TO authenticated
  USING (employee_user_id = auth.uid());
