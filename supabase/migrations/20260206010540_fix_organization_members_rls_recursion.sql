/*
  # Fix Infinite Recursion in organization_members RLS Policies

  1. Problem
    - organization_members policies query the organization_members table itself
    - This causes infinite recursion when any table (like work_orders) checks membership
    - The user_is_org_member function also queries organization_members, triggering the same loop

  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS to check membership
    - Replace all self-referencing policies with ones that use this safe function
    - Update user_is_org_member to also be SECURITY DEFINER

  3. Security Changes
    - Drop and recreate problematic policies on organization_members
    - All policies still enforce proper authentication and ownership checks
*/

CREATE OR REPLACE FUNCTION auth_user_is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION auth_user_is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role = ANY(ARRAY['owner', 'admin'])
  );
$$;

CREATE OR REPLACE FUNCTION auth_user_is_org_owner(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = org_id
    AND owner_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Organization owners can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Organization owners can add members" ON organization_members;

CREATE POLICY "Members can view own organization members"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (auth_user_is_org_member(organization_id));

CREATE POLICY "Admins can insert organization members"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_is_org_owner(organization_id)
    OR auth_user_is_org_admin(organization_id)
  );

CREATE POLICY "Admins can update organization members"
  ON organization_members
  FOR UPDATE
  TO authenticated
  USING (auth_user_is_org_admin(organization_id))
  WITH CHECK (auth_user_is_org_admin(organization_id));

CREATE POLICY "Admins can delete organization members"
  ON organization_members
  FOR DELETE
  TO authenticated
  USING (auth_user_is_org_admin(organization_id));

CREATE OR REPLACE FUNCTION user_is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
$$;
