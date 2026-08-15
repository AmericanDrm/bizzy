/*
  # Enhance Checklist Templates for Job Creation

  Enhances existing checklist_templates tables:
  - Add missing columns needed for job creation integration
  - Add is_shared flag for organization-wide templates
  - Add notes field to template items
  - Add organization_id where needed
  - Set up RLS policies
  - Create indexes
*/

-- =====================================================
-- PART 1: ENHANCE CHECKLIST_TEMPLATES TABLE
-- =====================================================

DO $$
BEGIN
  -- Add title column (alias for name)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checklist_templates' AND column_name = 'title'
  ) THEN
    ALTER TABLE checklist_templates ADD COLUMN title text;
    -- Copy name to title for existing records
    UPDATE checklist_templates SET title = name WHERE title IS NULL;
  END IF;

  -- Add is_shared column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checklist_templates' AND column_name = 'is_shared'
  ) THEN
    ALTER TABLE checklist_templates ADD COLUMN is_shared boolean DEFAULT true;
  END IF;

  -- Ensure organization_id exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checklist_templates' AND column_name = 'organization_id'
  ) THEN
    -- Make sure it has proper constraint
    ALTER TABLE checklist_templates ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

-- =====================================================
-- PART 2: ENHANCE CHECKLIST_TEMPLATE_ITEMS TABLE
-- =====================================================

DO $$
BEGIN
  -- Add organization_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checklist_template_items' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE checklist_template_items ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Add description column (alias for label)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checklist_template_items' AND column_name = 'description'
  ) THEN
    ALTER TABLE checklist_template_items ADD COLUMN description text;
    -- Copy label to description for existing records
    UPDATE checklist_template_items SET description = label WHERE description IS NULL;
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checklist_template_items' AND column_name = 'notes'
  ) THEN
    ALTER TABLE checklist_template_items ADD COLUMN notes text DEFAULT '';
  END IF;

  -- Add display_order (alias for sort_order)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checklist_template_items' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE checklist_template_items ADD COLUMN display_order integer DEFAULT 0;
    -- Copy sort_order to display_order for existing records
    UPDATE checklist_template_items SET display_order = sort_order WHERE display_order = 0;
  END IF;

  -- Add template_id (alias for checklist_template_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checklist_template_items' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE checklist_template_items ADD COLUMN template_id uuid REFERENCES checklist_templates(id) ON DELETE CASCADE;
    -- Copy checklist_template_id to template_id for existing records
    UPDATE checklist_template_items SET template_id = checklist_template_id WHERE template_id IS NULL;
  END IF;
END $$;

-- =====================================================
-- PART 3: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_checklist_templates_org_id 
  ON checklist_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_created_by 
  ON checklist_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_shared 
  ON checklist_templates(organization_id, is_shared);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template_id 
  ON checklist_template_items(template_id);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_display_order 
  ON checklist_template_items(template_id, display_order);

-- =====================================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 5: CREATE RLS POLICIES FOR CHECKLIST_TEMPLATES
-- =====================================================

-- View: Members can view shared templates or their own templates
DROP POLICY IF EXISTS "Organization members can view templates" ON checklist_templates;
CREATE POLICY "Organization members can view templates"
  ON checklist_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
    AND (is_shared = true OR created_by = auth.uid())
  );

-- Insert: Non-basic users can create templates
DROP POLICY IF EXISTS "Non-basic users can create templates" ON checklist_templates;
CREATE POLICY "Non-basic users can create templates"
  ON checklist_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('crew_lead', 'manager', 'admin', 'owner')
    )
  );

-- Update: Creators can edit their own templates
DROP POLICY IF EXISTS "Users can update own templates" ON checklist_templates;
CREATE POLICY "Users can update own templates"
  ON checklist_templates FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Delete: Non-basic users can delete any template
DROP POLICY IF EXISTS "Non-basic users can delete templates" ON checklist_templates;
CREATE POLICY "Non-basic users can delete templates"
  ON checklist_templates FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('crew_lead', 'manager', 'admin', 'owner')
    )
  );

-- =====================================================
-- PART 6: CREATE RLS POLICIES FOR CHECKLIST_TEMPLATE_ITEMS
-- =====================================================

-- View: Members can view items from accessible templates
DROP POLICY IF EXISTS "Organization members can view template items" ON checklist_template_items;
CREATE POLICY "Organization members can view template items"
  ON checklist_template_items FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM checklist_templates 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Insert: Template creators can add items
DROP POLICY IF EXISTS "Template creators can add items" ON checklist_template_items;
CREATE POLICY "Template creators can add items"
  ON checklist_template_items FOR INSERT
  TO authenticated
  WITH CHECK (
    template_id IN (
      SELECT id FROM checklist_templates 
      WHERE created_by = auth.uid()
    )
  );

-- Update: Template creators can update items
DROP POLICY IF EXISTS "Template creators can update items" ON checklist_template_items;
CREATE POLICY "Template creators can update items"
  ON checklist_template_items FOR UPDATE
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM checklist_templates 
      WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM checklist_templates 
      WHERE created_by = auth.uid()
    )
  );

-- Delete: Template creators can delete items
DROP POLICY IF EXISTS "Template creators can delete items" ON checklist_template_items;
CREATE POLICY "Template creators can delete items"
  ON checklist_template_items FOR DELETE
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM checklist_templates 
      WHERE created_by = auth.uid()
    )
  );