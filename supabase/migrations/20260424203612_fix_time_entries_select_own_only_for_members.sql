/*
  # Restrict time_entries SELECT to own records for regular members

  ## Summary
  Previously, the `members_select` policy on `time_entries` allowed any org member
  to read ALL time entries in the organization. This means employees could see each
  other's hours.

  ## Change
  - Drop the existing permissive `members_select` policy
  - Add two separate SELECT policies:
    1. `members_select_own` — members can only read their own time entries
    2. `managers_admin_select_all` — org managers/admins/owners can read all entries in their org

  ## Security
  - Regular employees see only their own time entries
  - Managers, admins, and owners retain full visibility for payroll and reporting
*/

-- Drop the old permissive policy
DROP POLICY IF EXISTS "members_select" ON time_entries;

-- Members can only see their own entries
CREATE POLICY "members_select_own"
  ON time_entries
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Managers/admins/owners can see all entries in their org
CREATE POLICY "managers_admin_select_all"
  ON time_entries
  FOR SELECT
  TO authenticated
  USING (is_org_manager_or_admin(organization_id));
