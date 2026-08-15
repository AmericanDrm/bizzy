/*
  # Fix Time Entries RLS Policies for Manager Access

  ## Summary
  Managers, admins, and owners need to be able to view, edit, and delete any org
  member's time entries. Regular members should only edit/delete their own entries.

  ## Changes
  1. New helper function `is_org_manager_or_admin` - returns true for owner/admin/manager roles
  2. Replaces the overly-permissive `members_update` policy with a role-aware policy:
     - Regular members can only UPDATE their own time entries
     - Owners, admins, and managers can UPDATE any org member's time entries
  3. Replaces `admins_delete` policy with a manager-inclusive delete policy:
     - Previously only owner/admin could delete
     - Now owner/admin/manager can delete any org member's time entries

  ## Security
  - Regular employees retain full access to their own entries
  - Elevated roles (manager/admin/owner) can manage any team member's entries
  - All operations still restricted to same-organization entries via organization_id check
*/

-- Helper function: returns true for owner, admin, or manager roles
CREATE OR REPLACE FUNCTION is_org_manager_or_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (select auth.uid()) IS NULL THEN false
    WHEN check_org_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = check_org_id
      AND user_id = (select auth.uid())
      AND role IN ('owner', 'admin', 'manager')
    )
  END;
$$;

-- Drop the overly-permissive update policy (allowed any member to update any entry)
DROP POLICY IF EXISTS "members_update" ON time_entries;

-- New update policy: own entries for members, any entry for managers/admins/owners
CREATE POLICY "members_own_or_admin_update"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_org_manager_or_admin(organization_id)
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR is_org_manager_or_admin(organization_id)
  );

-- Drop the admin-only delete policy
DROP POLICY IF EXISTS "admins_delete" ON time_entries;

-- New delete policy: managers, admins, and owners can delete any org member's entry
CREATE POLICY "managers_admin_delete"
  ON time_entries FOR DELETE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_org_manager_or_admin(organization_id)
  );
