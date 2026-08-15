/*
  # Enhance Job Checklists System

  Adds missing columns and features to existing job_checklists tables:
  - Add description column to job_checklists
  - Add organization_id, description, notes, created_by, display_order to job_checklist_items  
  - Rename columns for consistency
  - Add indexes and RLS policies
  - Add progress tracking function
*/

-- =====================================================
-- PART 1: ENHANCE JOB_CHECKLISTS TABLE
-- =====================================================

DO $$
BEGIN
  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklists' AND column_name = 'description'
  ) THEN
    ALTER TABLE job_checklists ADD COLUMN description text DEFAULT '';
  END IF;

  -- Rename name to title if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklists' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklists' AND column_name = 'title'
  ) THEN
    ALTER TABLE job_checklists RENAME COLUMN name TO title;
  END IF;
END $$;

-- =====================================================
-- PART 2: ENHANCE JOB_CHECKLIST_ITEMS TABLE
-- =====================================================

DO $$
BEGIN
  -- Add organization_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE job_checklist_items ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Add description/notes columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'description'
  ) THEN
    ALTER TABLE job_checklist_items ADD COLUMN description text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'notes'
  ) THEN
    ALTER TABLE job_checklist_items ADD COLUMN notes text DEFAULT '';
  END IF;

  -- Add created_by if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE job_checklist_items ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add display_order if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE job_checklist_items ADD COLUMN display_order integer DEFAULT 0;
  END IF;

  -- Rename checklist_id column if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'job_checklist_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'checklist_id'
  ) THEN
    ALTER TABLE job_checklist_items RENAME COLUMN job_checklist_id TO checklist_id;
  END IF;

  -- Copy label to description if label exists and description is empty
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'label'
  ) THEN
    UPDATE job_checklist_items SET description = label WHERE description = '';
  END IF;

  -- Copy sort_order to display_order if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_checklist_items' AND column_name = 'sort_order'
  ) THEN
    UPDATE job_checklist_items SET display_order = sort_order WHERE display_order = 0;
  END IF;
END $$;

-- =====================================================
-- PART 3: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_job_checklists_org_id 
  ON job_checklists(organization_id);

CREATE INDEX IF NOT EXISTS idx_job_checklists_job_id 
  ON job_checklists(job_id);

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_org_id 
  ON job_checklist_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_checklist_id 
  ON job_checklist_items(checklist_id);

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_display_order 
  ON job_checklist_items(checklist_id, display_order);

-- =====================================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE job_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklist_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 5: CREATE RLS POLICIES FOR JOB_CHECKLISTS
-- =====================================================

-- View: All organization members can view checklists
DROP POLICY IF EXISTS "Organization members can view job checklists" ON job_checklists;
CREATE POLICY "Organization members can view job checklists"
  ON job_checklists FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Insert: Only non-basic users can create checklists
DROP POLICY IF EXISTS "Non-basic users can create job checklists" ON job_checklists;
CREATE POLICY "Non-basic users can create job checklists"
  ON job_checklists FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('crew_lead', 'manager', 'admin', 'owner')
    )
  );

-- Update: Only non-basic users can update checklists
DROP POLICY IF EXISTS "Non-basic users can update job checklists" ON job_checklists;
CREATE POLICY "Non-basic users can update job checklists"
  ON job_checklists FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('crew_lead', 'manager', 'admin', 'owner')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('crew_lead', 'manager', 'admin', 'owner')
    )
  );

-- Delete: Only non-basic users can delete checklists
DROP POLICY IF EXISTS "Non-basic users can delete job checklists" ON job_checklists;
CREATE POLICY "Non-basic users can delete job checklists"
  ON job_checklists FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('crew_lead', 'manager', 'admin', 'owner')
    )
  );

-- =====================================================
-- PART 6: CREATE RLS POLICIES FOR JOB_CHECKLIST_ITEMS
-- =====================================================

-- View: All organization members can view checklist items
DROP POLICY IF EXISTS "Organization members can view checklist items" ON job_checklist_items;
CREATE POLICY "Organization members can view checklist items"
  ON job_checklist_items FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Insert: All organization members can add checklist items
DROP POLICY IF EXISTS "Organization members can add checklist items" ON job_checklist_items;
CREATE POLICY "Organization members can add checklist items"
  ON job_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Update: All organization members can update checklist items
DROP POLICY IF EXISTS "Organization members can update checklist items" ON job_checklist_items;
CREATE POLICY "Organization members can update checklist items"
  ON job_checklist_items FOR UPDATE
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

-- Delete: Only non-basic users can delete checklist items
DROP POLICY IF EXISTS "Non-basic users can delete checklist items" ON job_checklist_items;
CREATE POLICY "Non-basic users can delete checklist items"
  ON job_checklist_items FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('crew_lead', 'manager', 'admin', 'owner')
    )
  );

-- =====================================================
-- PART 7: CREATE HELPER FUNCTION FOR PROGRESS
-- =====================================================

-- Function to get checklist progress
CREATE OR REPLACE FUNCTION get_checklist_progress(checklist_uuid uuid)
RETURNS TABLE(total_items bigint, completed_items bigint, progress_percentage numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_items,
    COUNT(*) FILTER (WHERE is_completed = true)::bigint as completed_items,
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE is_completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
    END as progress_percentage
  FROM job_checklist_items
  WHERE checklist_id = checklist_uuid;
END;
$$;