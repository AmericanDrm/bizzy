/*
  # Fix RLS Performance and Security Issues
  
  1. Performance Improvements
    - Wrap auth.uid() in (select auth.uid()) for better query planning
    - Fix policies on profiles, organizations, and organization_members tables
  
  2. Security Fixes
    - Remove duplicate permissive policies that create confusion
    - Fix prevent_org_id_change function with SECURITY DEFINER and stable search path
  
  3. Policy Consolidation
    - Remove redundant time_entry_* policies from break_entries (covered by members_*)
    - Remove redundant estimate_* policies from estimate_items (covered by members_*)
    - Remove redundant invoice_* policies from invoice_items (covered by members_*)
    - Remove redundant own_* policies from crew_live_locations (covered by members_*)
    - Remove redundant user_* policies from push_notifications (covered by members_*)
    - Remove redundant admin_* policies from team_notes (duplicates of admins_*)
*/

-- ============================================================================
-- PART 1: Fix RLS Performance on profiles table
-- ============================================================================

DROP POLICY IF EXISTS "users_delete" ON profiles;
DROP POLICY IF EXISTS "users_insert" ON profiles;
DROP POLICY IF EXISTS "users_select" ON profiles;
DROP POLICY IF EXISTS "users_update" ON profiles;

CREATE POLICY "users_delete"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "users_insert"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "users_select"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (id = (select auth.uid())) 
    OR 
    (EXISTS (
      SELECT 1
      FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = (select auth.uid())
        AND om2.user_id = profiles.id
    ))
  );

CREATE POLICY "users_update"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- ============================================================================
-- PART 2: Fix RLS Performance on organizations table
-- ============================================================================

DROP POLICY IF EXISTS "owners_delete" ON organizations;
DROP POLICY IF EXISTS "users_insert" ON organizations;

CREATE POLICY "owners_delete"
  ON organizations
  FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE POLICY "users_insert"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

-- ============================================================================
-- PART 3: Fix RLS Performance on organization_members table
-- ============================================================================

DROP POLICY IF EXISTS "admin_insert" ON organization_members;
DROP POLICY IF EXISTS "members_select" ON organization_members;

CREATE POLICY "admin_insert"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_admin(organization_id) 
    OR 
    (user_id = (select auth.uid()) AND role = 'owner')
  );

CREATE POLICY "members_select"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    (user_id = (select auth.uid()))
    OR 
    is_org_member(organization_id)
  );

-- ============================================================================
-- PART 4: Remove Duplicate Permissive Policies
-- ============================================================================

-- break_entries: Remove redundant time_entry_* policies
DROP POLICY IF EXISTS "time_entry_delete" ON break_entries;
DROP POLICY IF EXISTS "time_entry_insert" ON break_entries;
DROP POLICY IF EXISTS "time_entry_select" ON break_entries;
DROP POLICY IF EXISTS "time_entry_update" ON break_entries;

-- crew_live_locations: Remove redundant own_* policies
DROP POLICY IF EXISTS "own_delete" ON crew_live_locations;
DROP POLICY IF EXISTS "own_update" ON crew_live_locations;

-- estimate_items: Remove redundant estimate_* policies
DROP POLICY IF EXISTS "estimate_delete" ON estimate_items;
DROP POLICY IF EXISTS "estimate_insert" ON estimate_items;
DROP POLICY IF EXISTS "estimate_select" ON estimate_items;
DROP POLICY IF EXISTS "estimate_update" ON estimate_items;

-- invoice_items: Remove redundant invoice_* policies
DROP POLICY IF EXISTS "invoice_delete" ON invoice_items;
DROP POLICY IF EXISTS "invoice_insert" ON invoice_items;
DROP POLICY IF EXISTS "invoice_select" ON invoice_items;
DROP POLICY IF EXISTS "invoice_update" ON invoice_items;

-- push_notifications: Remove redundant user_* policies
DROP POLICY IF EXISTS "user_org_select" ON push_notifications;
DROP POLICY IF EXISTS "user_update" ON push_notifications;

-- team_notes: Remove duplicate admin_* policies (keep admins_*)
DROP POLICY IF EXISTS "admin_delete" ON team_notes;
DROP POLICY IF EXISTS "admin_insert" ON team_notes;
DROP POLICY IF EXISTS "admin_update" ON team_notes;

-- ============================================================================
-- PART 5: Fix prevent_org_id_change Function Security
-- ============================================================================

-- Recreate the function with SECURITY DEFINER and STABLE volatility
CREATE OR REPLACE FUNCTION prevent_org_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- On UPDATE, organization_id must not change
  IF TG_OP = 'UPDATE' AND OLD.organization_id IS NOT NULL THEN
    IF NEW.organization_id != OLD.organization_id THEN
      RAISE EXCEPTION 'Cannot change organization_id of existing record';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Verification
-- ============================================================================

-- Count remaining policies per table to ensure no duplicates
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT tablename, cmd, COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
      AND tablename IN (
        'break_entries', 'crew_live_locations', 'estimate_items',
        'invoice_items', 'push_notifications', 'team_notes'
      )
    GROUP BY tablename, cmd
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Still have % tables with duplicate permissive policies', duplicate_count;
  ELSE
    RAISE NOTICE 'All duplicate permissive policies resolved successfully';
  END IF;
END;
$$;
