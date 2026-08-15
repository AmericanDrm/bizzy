/*
  # Add Shopping List and Supply Catalog Tables

  ## Overview
  This migration supports the "Supplies Needed" feature — a to-do style shopping
  list that is independent of job templates, with price tracking and a global
  reusable supply catalog for auto-fill.

  ## New Tables

  ### 1. `supply_catalog`
  - A global reference table (per organization) of previously used supply items.
  - Used for autocomplete/auto-fill when adding items to shopping lists.
  - Stores the most recently used price and unit so future entries pre-populate.

  Columns:
  - `id` (uuid, PK)
  - `organization_id` (uuid, FK → organizations)
  - `name` (text) — normalized item name
  - `default_unit` (text) — most recently used unit
  - `last_price` (numeric) — most recently recorded price
  - `usage_count` (integer) — how many times this item has been added
  - `created_at`, `updated_at`

  ### 2. `shopping_lists`
  - A named shopping/task list container owned by a user.
  - Optionally linked to a job (schedule_event) for convenience.

  Columns:
  - `id` (uuid, PK)
  - `organization_id` (uuid, FK → organizations)
  - `created_by` (uuid, FK → auth.users)
  - `title` (text)
  - `notes` (text)
  - `schedule_event_id` (uuid, nullable FK → schedule_events)
  - `is_completed` (boolean)
  - `created_at`, `updated_at`

  ### 3. `shopping_list_items`
  - Individual line items within a shopping list, with checkbox + price tracking.
  - Optionally references a catalog entry for historical price lookup.

  Columns:
  - `id` (uuid, PK)
  - `shopping_list_id` (uuid, FK → shopping_lists)
  - `organization_id` (uuid, FK → organizations)
  - `catalog_id` (uuid, nullable FK → supply_catalog) — links to catalog for history
  - `name` (text)
  - `quantity` (numeric)
  - `unit` (text)
  - `price` (numeric) — price per unit
  - `notes` (text)
  - `is_purchased` (boolean) — checkbox state
  - `purchased_at` (timestamptz) — when it was marked purchased
  - `display_order` (integer)
  - `created_at`, `updated_at`

  ## Security
  - RLS enabled on all three tables
  - Organization members can view, insert, update
  - Non-basic roles (owner, admin, manager) can delete lists
  - All members can delete their own shopping list items
*/

-- =============================================
-- supply_catalog
-- =============================================
CREATE TABLE IF NOT EXISTS supply_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_unit text DEFAULT '',
  last_price numeric,
  usage_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supply_catalog_org_name
  ON supply_catalog (organization_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_supply_catalog_org
  ON supply_catalog (organization_id);

ALTER TABLE supply_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view supply catalog"
  ON supply_catalog FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert supply catalog"
  ON supply_catalog FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update supply catalog"
  ON supply_catalog FOR UPDATE
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

CREATE POLICY "Managers and above can delete supply catalog"
  ON supply_catalog FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- =============================================
-- shopping_lists
-- =============================================
CREATE TABLE IF NOT EXISTS shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text DEFAULT '',
  schedule_event_id uuid REFERENCES schedule_events(id) ON DELETE SET NULL,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_org
  ON shopping_lists (organization_id);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_created_by
  ON shopping_lists (created_by);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_schedule_event
  ON shopping_lists (schedule_event_id);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view shopping lists"
  ON shopping_lists FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert shopping lists"
  ON shopping_lists FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update shopping lists"
  ON shopping_lists FOR UPDATE
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

CREATE POLICY "Managers and above can delete shopping lists"
  ON shopping_lists FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- =============================================
-- shopping_list_items
-- =============================================
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES supply_catalog(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric,
  unit text DEFAULT '',
  price numeric,
  notes text DEFAULT '',
  is_purchased boolean DEFAULT false,
  purchased_at timestamptz,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list
  ON shopping_list_items (shopping_list_id);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_org
  ON shopping_list_items (organization_id);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_catalog
  ON shopping_list_items (catalog_id);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view shopping list items"
  ON shopping_list_items FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert shopping list items"
  ON shopping_list_items FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update shopping list items"
  ON shopping_list_items FOR UPDATE
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

CREATE POLICY "Org members can delete shopping list items"
  ON shopping_list_items FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
