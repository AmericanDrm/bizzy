/*
  # Enhance Client Photos for Camera Feature

  1. Enhancements
    - Add checklist_item_id for photo-to-checklist conversion
    - Add is_deleted flag for soft deletes (Owner/Manager only)
    - Add deleted_at and deleted_by tracking
    - Add thumbnail_url for performance
    - Add file_size for storage management

  2. Indexes
    - Add index on client_id for fast photo lookup
    - Add index on checklist_item_id for checklist associations
    - Add index on is_deleted for filtering

  3. RLS Updates
    - Owners and Managers can delete photos
    - All org members can view photos
    - All org members can create photos
*/

-- =====================================================
-- PART 1: ADD NEW COLUMNS
-- =====================================================

DO $$
BEGIN
  -- Add checklist_item_id for photo attachments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'checklist_item_id'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN checklist_item_id uuid REFERENCES job_checklist_items(id) ON DELETE SET NULL;
  END IF;

  -- Add soft delete flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;

  -- Add deleted tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;

  -- Add thumbnail support
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN thumbnail_url text;
  END IF;

  -- Add file size tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN file_size bigint;
  END IF;
END $$;

-- =====================================================
-- PART 2: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_client_photos_client_id 
  ON client_photos(client_id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_client_photos_checklist_item_id 
  ON client_photos(checklist_item_id);

CREATE INDEX IF NOT EXISTS idx_client_photos_is_deleted 
  ON client_photos(is_deleted);

CREATE INDEX IF NOT EXISTS idx_client_photos_captured_at 
  ON client_photos(captured_at DESC) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_client_photos_location 
  ON client_photos(latitude, longitude) WHERE is_deleted = false;

-- =====================================================
-- PART 3: UPDATE RLS POLICIES
-- =====================================================

-- View: All org members can view non-deleted photos
DROP POLICY IF EXISTS "Organization members can view photos" ON client_photos;
CREATE POLICY "Organization members can view photos"
  ON client_photos FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
    AND is_deleted = false
  );

-- Insert: All org members can create photos
DROP POLICY IF EXISTS "Organization members can create photos" ON client_photos;
CREATE POLICY "Organization members can create photos"
  ON client_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Update: Users can update their own photos, Managers+ can soft delete
DROP POLICY IF EXISTS "Users can update photos" ON client_photos;
CREATE POLICY "Users can update photos"
  ON client_photos FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
    AND (
      user_id = auth.uid() 
      OR auth.uid() IN (
        SELECT user_id FROM organization_members 
        WHERE organization_id = client_photos.organization_id
        AND role IN ('manager', 'admin', 'owner')
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Delete: Managers+ can hard delete photos
DROP POLICY IF EXISTS "Managers can delete photos" ON client_photos;
CREATE POLICY "Managers can delete photos"
  ON client_photos FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'admin', 'owner')
    )
  );