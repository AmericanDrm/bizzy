/*
  # Create equipment tags and tag assignments

  1. New Tables
    - `equipment_tags`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `name` (text) - tag name e.g. "Ladders", "Safety Gear", "Vehicle Mounted"
      - `color` (text) - hex color for visual display
      - `created_at` (timestamptz)
    - `equipment_tag_assignments`
      - `id` (uuid, primary key)
      - `equipment_id` (uuid, FK to equipment_inventory)
      - `tag_id` (uuid, FK to equipment_tags)
      - `organization_id` (uuid, FK to organizations)
      - `created_at` (timestamptz)
      - Unique constraint on (equipment_id, tag_id)

  2. Security
    - Enable RLS on both tables
    - Policies restrict access to authenticated organization members
*/

CREATE TABLE IF NOT EXISTS equipment_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view equipment tags"
  ON equipment_tags FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert equipment tags"
  ON equipment_tags FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update equipment tags"
  ON equipment_tags FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete equipment tags"
  ON equipment_tags FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS equipment_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment_inventory(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES equipment_tags(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(equipment_id, tag_id)
);

ALTER TABLE equipment_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view equipment tag assignments"
  ON equipment_tag_assignments FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert equipment tag assignments"
  ON equipment_tag_assignments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update equipment tag assignments"
  ON equipment_tag_assignments FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete equipment tag assignments"
  ON equipment_tag_assignments FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_equipment_tags_org ON equipment_tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_equipment_tag_assignments_equipment ON equipment_tag_assignments(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_tag_assignments_tag ON equipment_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_equipment_tag_assignments_org ON equipment_tag_assignments(organization_id);
