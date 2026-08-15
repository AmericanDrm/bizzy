/*
  # Photo Annotation and Checklist Item Photos Enhancement

  ## Overview
  Enhances the client_photos table and job_checklist_items table to support:
  1. Photo annotation (drawn markups saved as a separate URL)
  2. Direct photo attachment to checklist items via a linking table
  3. Multiple photos per checklist item

  ## Changes

  ### Modified Tables
  - `client_photos`
    - `annotation_data` (text) - JSON blob of annotation strokes/text for redrawing
    - `annotated_url` (text) - URL of the flattened annotated image saved to storage

  ### New Tables
  - `checklist_item_photos`
    - Links client_photos to job_checklist_items (many-to-many)
    - Allows a photo to be attached to multiple checklist items
    - Allows a checklist item to have multiple photos

  ## Security
  - RLS enabled on new table
  - Organization-scoped policies for all operations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'annotation_data'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN annotation_data text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'annotated_url'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN annotated_url text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS checklist_item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  checklist_item_id uuid NOT NULL REFERENCES job_checklist_items(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES client_photos(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checklist_item_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_item_photos_item_id ON checklist_item_photos(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_photos_photo_id ON checklist_item_photos(photo_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_photos_org_id ON checklist_item_photos(organization_id);

ALTER TABLE checklist_item_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view checklist item photos"
  ON checklist_item_photos FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert checklist item photos"
  ON checklist_item_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete checklist item photos"
  ON checklist_item_photos FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
