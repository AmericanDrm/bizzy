/*
  # Fix Organization Members Infinite Recursion

  1. Problem
    - RLS policies on organization_members query the same table
    - This causes infinite recursion when PostgreSQL evaluates policies

  2. Solution
    - Create a security definer function to check membership without RLS
    - Replace self-referencing policies with direct user_id checks
    - Use the helper function for admin operations

  3. Changes
    - Drop existing problematic policies
    - Create is_org_admin helper function (security definer)
    - Create new non-recursive policies
*/

-- Create a security definer function to check if user is admin/owner
-- This bypasses RLS to avoid recursion
CREATE OR REPLACE FUNCTION is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

-- Create a function to check if user is member of org
CREATE OR REPLACE FUNCTION is_org_member(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "members_select" ON organization_members;
DROP POLICY IF EXISTS "admin_insert" ON organization_members;
DROP POLICY IF EXISTS "admin_update" ON organization_members;
DROP POLICY IF EXISTS "admin_delete" ON organization_members;

-- New SELECT policy: Users can see all members of orgs they belong to
-- Uses direct user_id check for their own row, plus security definer function for others
CREATE POLICY "members_select" ON organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR is_org_member(organization_id)
  );

-- New INSERT policy: Admins can add members, or user can create their own owner membership
CREATE POLICY "admin_insert" ON organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_admin(organization_id)
    OR (user_id = auth.uid() AND role = 'owner')
  );

-- New UPDATE policy: Only admins can update memberships
CREATE POLICY "admin_update" ON organization_members
  FOR UPDATE TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- New DELETE policy: Only admins can delete memberships (but not self for owners)
CREATE POLICY "admin_delete" ON organization_members
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));
