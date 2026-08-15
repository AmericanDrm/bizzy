/*
  # Add organization_id to child tables

  1. Overview
    - Add organization_id to invoice_items, estimate_items, break_entries
    - Simplify RLS policies to avoid complex JOINs that could cause recursion

  2. Changes
    - Add organization_id column to child tables
    - Populate from parent tables
    - Create simple role-based policies using helper functions
*/

-- =============================================================================
-- INVOICE_ITEMS
-- =============================================================================

-- Add organization_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate from invoices
UPDATE invoice_items ii
SET organization_id = i.organization_id
FROM invoices i
WHERE ii.invoice_id = i.id AND ii.organization_id IS NULL;

-- Make NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'organization_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE invoice_items ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoice_items_organization_id ON invoice_items(organization_id);

-- Drop old policies
DROP POLICY IF EXISTS "parent_select" ON invoice_items;
DROP POLICY IF EXISTS "parent_insert" ON invoice_items;
DROP POLICY IF EXISTS "parent_update" ON invoice_items;
DROP POLICY IF EXISTS "parent_delete" ON invoice_items;

-- Create new policies
CREATE POLICY "members_select" ON invoice_items FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON invoice_items FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON invoice_items FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON invoice_items FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- =============================================================================
-- ESTIMATE_ITEMS
-- =============================================================================

-- Add organization_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE estimate_items ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate from estimates
UPDATE estimate_items ei
SET organization_id = e.organization_id
FROM estimates e
WHERE ei.estimate_id = e.id AND ei.organization_id IS NULL;

-- Make NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'organization_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE estimate_items ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estimate_items_organization_id ON estimate_items(organization_id);

-- Drop old policies
DROP POLICY IF EXISTS "parent_select" ON estimate_items;
DROP POLICY IF EXISTS "parent_insert" ON estimate_items;
DROP POLICY IF EXISTS "parent_update" ON estimate_items;
DROP POLICY IF EXISTS "parent_delete" ON estimate_items;

-- Create new policies
CREATE POLICY "members_select" ON estimate_items FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON estimate_items FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON estimate_items FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON estimate_items FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- =============================================================================
-- BREAK_ENTRIES
-- =============================================================================

-- Add organization_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'break_entries' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE break_entries ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate from time_entries
UPDATE break_entries be
SET organization_id = te.organization_id
FROM time_entries te
WHERE be.time_entry_id = te.id AND be.organization_id IS NULL;

-- Make NOT NULL (only if we have data to populate)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'break_entries' AND column_name = 'organization_id' AND is_nullable = 'YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM break_entries WHERE organization_id IS NULL
  ) THEN
    ALTER TABLE break_entries ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_break_entries_organization_id ON break_entries(organization_id);

-- Drop old policies
DROP POLICY IF EXISTS "parent_select" ON break_entries;
DROP POLICY IF EXISTS "parent_insert" ON break_entries;
DROP POLICY IF EXISTS "parent_update" ON break_entries;
DROP POLICY IF EXISTS "parent_delete" ON break_entries;

-- Create new policies
CREATE POLICY "members_select" ON break_entries FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON break_entries FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON break_entries FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON break_entries FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- =============================================================================
-- TRIGGERS TO AUTO-SET ORGANIZATION_ID
-- =============================================================================

-- Trigger for invoice_items
CREATE OR REPLACE FUNCTION set_invoice_item_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM invoices
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_item_org_id_trigger ON invoice_items;
CREATE TRIGGER set_invoice_item_org_id_trigger
  BEFORE INSERT ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_item_org_id();

-- Trigger for estimate_items
CREATE OR REPLACE FUNCTION set_estimate_item_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM estimates
  WHERE id = NEW.estimate_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_estimate_item_org_id_trigger ON estimate_items;
CREATE TRIGGER set_estimate_item_org_id_trigger
  BEFORE INSERT ON estimate_items
  FOR EACH ROW
  EXECUTE FUNCTION set_estimate_item_org_id();

-- Trigger for break_entries
CREATE OR REPLACE FUNCTION set_break_entry_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM time_entries
  WHERE id = NEW.time_entry_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_break_entry_org_id_trigger ON break_entries;
CREATE TRIGGER set_break_entry_org_id_trigger
  BEFORE INSERT ON break_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_break_entry_org_id();
