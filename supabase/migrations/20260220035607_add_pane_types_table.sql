/*
  # Add Pane Types Table

  ## Summary
  Introduces a `pane_types` table that lets each organization define their own set of
  pane type categories (e.g. Standard, French, Storm, Skylights) to replace the
  previously hardcoded pane style list.

  ## New Tables
  - `pane_types`
    - `id` (uuid, PK)
    - `organization_id` (uuid, FK to organizations)
    - `name` (text) — display name, e.g. "Standard", "Skylights"
    - `key` (text) — slugified identifier used as the key in pane_details JSON
    - `description` (text) — optional hint shown in the client card
    - `sort_order` (integer) — controls display order
    - `is_active` (boolean)
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled; admins/managers can manage, members can read

  ## Notes
  1. The four default pane types (Standard, French, Storm, Skylights) are seeded via a
     trigger that fires after a new organization is inserted.
  2. Existing `pane_details` JSONB data on `client_unit_quantities` uses keys like
     `standard_exterior`; the new system uses the simpler key (e.g. `standard`) stored
     directly in a flexible JSONB column — both coexist without migration.
*/

CREATE TABLE IF NOT EXISTS pane_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, key)
);

ALTER TABLE pane_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org pane types"
  ON pane_types FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert pane types"
  ON pane_types FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update pane types"
  ON pane_types FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete pane types"
  ON pane_types FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_pane_types_organization_id ON pane_types(organization_id);

-- Seed default pane types for all existing organizations
INSERT INTO pane_types (organization_id, name, key, description, sort_order)
SELECT
  id AS organization_id,
  unnest(ARRAY['Standard', 'French', 'Storm', 'Skylights']) AS name,
  unnest(ARRAY['standard', 'french', 'storm', 'skylights']) AS key,
  unnest(ARRAY[
    'Single/double-hung windows',
    'Multi-lite divided windows & doors',
    'Removable storm panels',
    'Roof-mounted glass panels'
  ]) AS description,
  unnest(ARRAY[0, 1, 2, 3]) AS sort_order
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

-- Trigger to seed defaults for new organizations
CREATE OR REPLACE FUNCTION seed_default_pane_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO pane_types (organization_id, name, key, description, sort_order) VALUES
    (NEW.id, 'Standard',  'standard',  'Single/double-hung windows',           0),
    (NEW.id, 'French',    'french',    'Multi-lite divided windows & doors',    1),
    (NEW.id, 'Storm',     'storm',     'Removable storm panels',               2),
    (NEW.id, 'Skylights', 'skylights', 'Roof-mounted glass panels',            3)
  ON CONFLICT (organization_id, key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_pane_types_on_org_created ON organizations;
CREATE TRIGGER seed_pane_types_on_org_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_pane_types();
