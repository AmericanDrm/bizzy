/*
  # Restrict time_entries UPDATE and DELETE to managers/admins/owners only

  ## Summary
  Previously the UPDATE policy allowed any member to update their own time entries,
  meaning employees could edit their own clock_in/clock_out times. This migration
  replaces both the UPDATE and DELETE policies so only managers, admins, and owners
  can modify time entries. Employees retain INSERT (to clock in/out) and SELECT
  (to view their own entries) but cannot alter or delete records.

  ## Changes
  - DROP `members_own_or_admin_update` policy — replaced with admin/manager-only UPDATE
  - DROP `managers_admin_delete` policy — replaced with cleaner admin/manager-only DELETE
  - New UPDATE: `admins_update` — only org managers/admins/owners can update any entry
  - New DELETE: `admins_delete` — only org managers/admins/owners can delete any entry

  ## Security
  - Employees can clock in/out (INSERT) but cannot edit times after the fact
  - Managers, admins, and owners retain full edit and delete capabilities
  - Preserves existing SELECT (own-only for members, all for managers) and INSERT policies
*/

DROP POLICY IF EXISTS "members_own_or_admin_update" ON time_entries;
DROP POLICY IF EXISTS "managers_admin_delete" ON time_entries;

CREATE POLICY "admins_update"
  ON time_entries
  FOR UPDATE
  TO authenticated
  USING (is_org_manager_or_admin(organization_id))
  WITH CHECK (is_org_manager_or_admin(organization_id));

CREATE POLICY "admins_delete"
  ON time_entries
  FOR DELETE
  TO authenticated
  USING (is_org_manager_or_admin(organization_id));
