/*
  # Restructure Production Rates and Add Multi-Team Assignments

  ## Overview
  This migration restructures the existing team_member_production_rates table
  and adds support for multi-team member assignments to schedule events.

  ## Changes

  1. Restructure team_member_production_rates table
  2. Create schedule_event_team_members junction table
  3. Create client_job_quantities table
  4. Migrate existing valid data
*/

-- Step 1: Create new schedule_event_team_members table
CREATE TABLE IF NOT EXISTS schedule_event_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_event_id uuid REFERENCES schedule_events(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES organization_members(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_event_team_members_event_id
  ON schedule_event_team_members(schedule_event_id);

CREATE INDEX IF NOT EXISTS idx_schedule_event_team_members_member_id
  ON schedule_event_team_members(member_id);

CREATE INDEX IF NOT EXISTS idx_schedule_event_team_members_org_id
  ON schedule_event_team_members(organization_id);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unique_schedule_event_member'
  ) THEN
    CREATE UNIQUE INDEX idx_unique_schedule_event_member
      ON schedule_event_team_members(schedule_event_id, member_id);
  END IF;
END $$;

-- Enable RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'schedule_event_team_members'
    AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE schedule_event_team_members ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies for schedule_event_team_members
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'schedule_event_team_members'
  ) THEN
    CREATE POLICY "Organization members can view team assignments"
      ON schedule_event_team_members
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = schedule_event_team_members.organization_id
          AND organization_members.user_id = auth.uid()
        )
      );

    CREATE POLICY "Admins and owners can insert team assignments"
      ON schedule_event_team_members
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = schedule_event_team_members.organization_id
          AND organization_members.user_id = auth.uid()
          AND organization_members.role IN ('owner', 'admin')
        )
      );

    CREATE POLICY "Admins and owners can delete team assignments"
      ON schedule_event_team_members
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = schedule_event_team_members.organization_id
          AND organization_members.user_id = auth.uid()
          AND organization_members.role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

-- Step 2: Restructure team_member_production_rates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_member_production_rates' AND column_name = 'unit_type'
  ) THEN
    ALTER TABLE team_member_production_rates ADD COLUMN unit_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_member_production_rates' AND column_name = 'custom_unit_label'
  ) THEN
    ALTER TABLE team_member_production_rates ADD COLUMN custom_unit_label text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_member_production_rates' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE team_member_production_rates ADD COLUMN member_id uuid REFERENCES organization_members(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate data from old schema to new schema
UPDATE team_member_production_rates SET member_id = user_id WHERE member_id IS NULL AND user_id IS NOT NULL;

-- Populate unit_type from job_types if possible
UPDATE team_member_production_rates pr
SET unit_type = jt.unit_of_measure,
    custom_unit_label = jt.custom_unit_label
FROM job_types jt
WHERE pr.job_type_id = jt.id
  AND pr.unit_type IS NULL;

-- Create indexes for team_member_production_rates
CREATE INDEX IF NOT EXISTS idx_team_member_production_rates_member_id_new
  ON team_member_production_rates(member_id);

CREATE INDEX IF NOT EXISTS idx_team_member_production_rates_unit_type_new
  ON team_member_production_rates(unit_type);

-- Step 3: Create client_job_quantities table
CREATE TABLE IF NOT EXISTS client_job_quantities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  job_type_id uuid REFERENCES job_types(id) ON DELETE CASCADE NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_job_quantities_client_id
  ON client_job_quantities(client_id);

CREATE INDEX IF NOT EXISTS idx_client_job_quantities_job_type_id
  ON client_job_quantities(job_type_id);

CREATE INDEX IF NOT EXISTS idx_client_job_quantities_org_id
  ON client_job_quantities(organization_id);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unique_client_job_quantity'
  ) THEN
    CREATE UNIQUE INDEX idx_unique_client_job_quantity
      ON client_job_quantities(client_id, job_type_id);
  END IF;
END $$;

-- Enable RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'client_job_quantities'
    AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE client_job_quantities ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies for client_job_quantities
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_job_quantities'
  ) THEN
    CREATE POLICY "Organization members can view client quantities"
      ON client_job_quantities
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = client_job_quantities.organization_id
          AND organization_members.user_id = auth.uid()
        )
      );

    CREATE POLICY "Organization members can manage client quantities"
      ON client_job_quantities
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = client_job_quantities.organization_id
          AND organization_members.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = client_job_quantities.organization_id
          AND organization_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Step 4: Create trigger function for auto-setting organization_id
CREATE OR REPLACE FUNCTION set_org_id_for_schedule_event_team_members()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM schedule_events
    WHERE id = NEW.schedule_event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_org_id_schedule_event_team_members ON schedule_event_team_members;

CREATE TRIGGER set_org_id_schedule_event_team_members
  BEFORE INSERT ON schedule_event_team_members
  FOR EACH ROW
  EXECUTE FUNCTION set_org_id_for_schedule_event_team_members();

-- Step 5: Migrate existing assigned_to values to schedule_event_team_members
-- Only migrate if the member_id exists in organization_members
INSERT INTO schedule_event_team_members (schedule_event_id, member_id, organization_id)
SELECT 
  se.id as schedule_event_id,
  se.assigned_to as member_id,
  se.organization_id
FROM schedule_events se
WHERE se.assigned_to IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.id = se.assigned_to
  )
  AND NOT EXISTS (
    SELECT 1 FROM schedule_event_team_members setm
    WHERE setm.schedule_event_id = se.id
    AND setm.member_id = se.assigned_to
  );
