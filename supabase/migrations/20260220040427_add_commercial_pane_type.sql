/*
  # Add Commercial Pane Type

  ## Summary
  Adds "Commercial" as a 5th default pane type (large commercial glass panels & storefronts).
  Updates the seed trigger so new organizations also get it automatically.

  ## Changes
  - Inserts Commercial pane type for all existing organizations (no-op if already exists)
  - Updates seed_default_pane_types() trigger function to include Commercial
*/

INSERT INTO pane_types (organization_id, name, key, description, sort_order)
SELECT
  id AS organization_id,
  'Commercial' AS name,
  'commercial' AS key,
  'Large commercial glass panels & storefronts' AS description,
  4 AS sort_order
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

CREATE OR REPLACE FUNCTION seed_default_pane_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO pane_types (organization_id, name, key, description, sort_order) VALUES
    (NEW.id, 'Standard',   'standard',   'Single/double-hung windows',                0),
    (NEW.id, 'French',     'french',     'Multi-lite divided windows & doors',         1),
    (NEW.id, 'Storm',      'storm',      'Removable storm panels',                    2),
    (NEW.id, 'Skylights',  'skylights',  'Roof-mounted glass panels',                 3),
    (NEW.id, 'Commercial', 'commercial', 'Large commercial glass panels & storefronts', 4)
  ON CONFLICT (organization_id, key) DO NOTHING;
  RETURN NEW;
END;
$$;
