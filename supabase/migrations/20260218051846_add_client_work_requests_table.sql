/*
  # Client Work Requests Table

  ## Overview
  Creates the `client_work_requests` table that captures appointment requests
  submitted by clients through the self-scheduling portal. This is the core
  table for the client self-scheduling feature.

  ## New Tables

  ### client_work_requests
  Stores appointment requests made by portal clients. Each row represents a
  client's request for a specific date/time window with their organization.

  - `id` - Primary key
  - `organization_id` - The org this request belongs to
  - `client_id` - FK to clients table
  - `portal_account_id` - FK to client_portal_accounts (the auth-linked account)
  - `requested_date` - The date the client wants an appointment
  - `requested_start_time` - Preferred start time (HH:MM)
  - `requested_end_time` - Preferred end time (HH:MM)
  - `service_type` - Optional free-text description of the service needed
  - `notes` - Any additional info from the client
  - `phone_call_requested` - True when the slot is busy and client wants a callback
  - `status` - Workflow state: pending | approved | declined | completed
  - `admin_notes` - Internal notes from the business after reviewing
  - `reviewed_at` - When the business reviewed the request
  - `reviewed_by` - Which staff member reviewed it
  - `created_at` / `updated_at` - Timestamps

  ## Security
  - RLS enabled
  - Clients can INSERT their own requests (verified via portal_account_id)
  - Clients can SELECT their own requests
  - Org members can SELECT/UPDATE all requests for their org
*/

CREATE TABLE IF NOT EXISTS client_work_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  portal_account_id uuid NOT NULL REFERENCES client_portal_accounts(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  requested_start_time text NOT NULL,
  requested_end_time text NOT NULL,
  service_type text DEFAULT '',
  notes text DEFAULT '',
  phone_call_requested boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'completed')),
  admin_notes text DEFAULT '',
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_requests_org_id ON client_work_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_requests_client_id ON client_work_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_work_requests_portal_account ON client_work_requests(portal_account_id);
CREATE INDEX IF NOT EXISTS idx_work_requests_date ON client_work_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_work_requests_status ON client_work_requests(status);

ALTER TABLE client_work_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal clients can insert own work requests"
  ON client_work_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    portal_account_id IN (
      SELECT id FROM client_portal_accounts
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Portal clients can view own work requests"
  ON client_work_requests
  FOR SELECT
  TO authenticated
  USING (
    portal_account_id IN (
      SELECT id FROM client_portal_accounts
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update work requests for their org"
  ON client_work_requests
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_work_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_requests_updated_at
  BEFORE UPDATE ON client_work_requests
  FOR EACH ROW EXECUTE FUNCTION update_work_requests_updated_at();
