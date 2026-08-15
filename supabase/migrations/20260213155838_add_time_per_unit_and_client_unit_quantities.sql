/*
  # Add time-per-unit to job types and client unit quantities

  1. Modified Tables
    - `job_types`
      - `time_per_unit` (numeric) - Hours required per unit of measurement (e.g., 0.1 = 6 minutes per pane)

  2. New Tables
    - `client_unit_quantities`
      - `id` (uuid, primary key)
      - `client_id` (uuid, FK to clients)
      - `job_type_id` (uuid, FK to job_types)
      - `quantity` (numeric) - Number of units (e.g., 100 panes, 2500 sqft)
      - `organization_id` (uuid, FK to organizations)
      - `created_at` / `updated_at` (timestamps)
      - Unique constraint on (client_id, job_type_id)

  3. Security
    - Enable RLS on `client_unit_quantities`
    - SELECT/INSERT/UPDATE/DELETE policies for org members

  4. Notes
    - When job type unit != 'hour' and time_per_unit is set:
      duration = client_quantity * time_per_unit (in hours)
    - Allows field-service businesses to estimate time from measurable units
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'time_per_unit'
  ) THEN
    ALTER TABLE job_types ADD COLUMN time_per_unit numeric DEFAULT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS client_unit_quantities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  job_type_id uuid NOT NULL REFERENCES job_types(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, job_type_id)
);

CREATE INDEX IF NOT EXISTS idx_client_unit_quantities_client_id ON client_unit_quantities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_unit_quantities_job_type_id ON client_unit_quantities(job_type_id);
CREATE INDEX IF NOT EXISTS idx_client_unit_quantities_org_id ON client_unit_quantities(organization_id);

ALTER TABLE client_unit_quantities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view client unit quantities"
  ON client_unit_quantities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_unit_quantities.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Org members can insert client unit quantities"
  ON client_unit_quantities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_unit_quantities.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Org members can update client unit quantities"
  ON client_unit_quantities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_unit_quantities.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_unit_quantities.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Org members can delete client unit quantities"
  ON client_unit_quantities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_unit_quantities.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );
