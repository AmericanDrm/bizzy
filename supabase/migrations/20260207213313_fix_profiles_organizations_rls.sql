/*
  # Fix Profiles and Organizations RLS

  1. Overview
    - Fix organizations table RLS to avoid recursion
    - Update profiles RLS to allow org members to view each other

  2. Changes
    - Drop and recreate organizations policies using helper functions
    - Update profiles policies to allow org-wide visibility
*/

-- =============================================================================
-- ORGANIZATIONS TABLE
-- =============================================================================

DROP POLICY IF EXISTS "own_org_select" ON organizations;
DROP POLICY IF EXISTS "owner_insert" ON organizations;
DROP POLICY IF EXISTS "owner_update" ON organizations;

-- Users can view organizations they belong to
CREATE POLICY "members_select" ON organizations
  FOR SELECT TO authenticated
  USING (is_org_member(id));

-- Users can create organizations (they become owners)
CREATE POLICY "users_insert" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Only owners can update their organization
CREATE POLICY "owners_update" ON organizations
  FOR UPDATE TO authenticated
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- Only owners can delete their organization
CREATE POLICY "owners_delete" ON organizations
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- =============================================================================
-- PROFILES TABLE
-- =============================================================================

DROP POLICY IF EXISTS "own_select" ON profiles;
DROP POLICY IF EXISTS "own_insert" ON profiles;
DROP POLICY IF EXISTS "own_update" ON profiles;
DROP POLICY IF EXISTS "own_delete" ON profiles;

-- Users can view their own profile + profiles of people in their org
CREATE POLICY "users_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid() AND om2.user_id = profiles.id
    )
  );

-- Users can insert their own profile
CREATE POLICY "users_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can delete their own profile
CREATE POLICY "users_delete" ON profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid());
