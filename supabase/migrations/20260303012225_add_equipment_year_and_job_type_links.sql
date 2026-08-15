/*
  # Add equipment year in service and job type links

  1. Modified Tables
    - `equipment_inventory`
      - Added `year_started_in_service` (integer) - Year the equipment was put into service

  2. New Tables
    - `equipment_job_type_assignments`
      - `id` (uuid, primary key)
      - `equipment_id` (uuid, references equipment_inventory)
      - `job_type_id` (uuid, references job_types)
      - `organization_id` (uuid, references organizations)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `equipment_job_type_assignments`
    - Policies for authenticated org members to manage assignments

  4. Notes
    - Links equipment to existing job types for categorization
    - Year in service helps track equipment age for maintenance planning
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_inventory' AND column_name = 'year_started_in_service'
  ) THEN
    ALTER TABLE equipment_inventory ADD COLUMN year_started_in_service integer;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS equipment_job_type_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment_inventory(id) ON DELETE CASCADE,
  job_type_id uuid NOT NULL REFERENCES job_types(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(equipment_id, job_type_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_job_type_assignments_equipment_id
  ON equipment_job_type_assignments(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_job_type_assignments_job_type_id
  ON equipment_job_type_assignments(job_type_id);
CREATE INDEX IF NOT EXISTS idx_equipment_job_type_assignments_org_id
  ON equipment_job_type_assignments(organization_id);

ALTER TABLE equipment_job_type_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'equipment_job_type_assignments' AND policyname = 'Org members can view equipment job type assignments'
  ) THEN
    CREATE POLICY "Org members can view equipment job type assignments"
      ON equipment_job_type_assignments FOR SELECT
      TO authenticated
      USING (
        organization_id IN (
          SELECT om.organization_id FROM organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'equipment_job_type_assignments' AND policyname = 'Org members can insert equipment job type assignments'
  ) THEN
    CREATE POLICY "Org members can insert equipment job type assignments"
      ON equipment_job_type_assignments FOR INSERT
      TO authenticated
      WITH CHECK (
        organization_id IN (
          SELECT om.organization_id FROM organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'equipment_job_type_assignments' AND policyname = 'Org members can delete equipment job type assignments'
  ) THEN
    CREATE POLICY "Org members can delete equipment job type assignments"
      ON equipment_job_type_assignments FOR DELETE
      TO authenticated
      USING (
        organization_id IN (
          SELECT om.organization_id FROM organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;
