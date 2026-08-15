/*
  # Add organization_id to client_addresses

  1. Overview
    - Add organization_id column to client_addresses for proper isolation
    - Update RLS policies to use helper functions instead of complex JOINs

  2. Changes
    - Add organization_id column with foreign key to organizations
    - Populate organization_id from related client records
    - Drop complex JOIN-based policies
    - Create new simple role-based policies
*/

-- Add organization_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate organization_id from clients
UPDATE client_addresses ca
SET organization_id = c.organization_id
FROM clients c
WHERE ca.client_id = c.id AND ca.organization_id IS NULL;

-- Make organization_id NOT NULL after populating
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' 
      AND column_name = 'organization_id' 
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE client_addresses ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_client_addresses_organization_id ON client_addresses(organization_id);

-- Drop old complex policies
DROP POLICY IF EXISTS "client_select" ON client_addresses;
DROP POLICY IF EXISTS "client_insert" ON client_addresses;
DROP POLICY IF EXISTS "client_update" ON client_addresses;
DROP POLICY IF EXISTS "client_delete" ON client_addresses;

-- Create new simple role-based policies
CREATE POLICY "members_select" ON client_addresses
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON client_addresses
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON client_addresses
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON client_addresses
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- Create trigger to auto-set organization_id from client
CREATE OR REPLACE FUNCTION set_client_address_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Get organization_id from the client
  SELECT organization_id INTO NEW.organization_id
  FROM clients
  WHERE id = NEW.client_id;
  
  -- If still null, use user's organization
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_client_address_org_id_trigger ON client_addresses;
CREATE TRIGGER set_client_address_org_id_trigger
  BEFORE INSERT ON client_addresses
  FOR EACH ROW
  EXECUTE FUNCTION set_client_address_org_id();
