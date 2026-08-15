/*
  # Fix business_settings INSERT policy

  ## Problem
  The INSERT policy on business_settings uses is_org_member(), which allows
  any employee to insert new business settings rows. This should be restricted
  to admins and owners only, consistent with the UPDATE and DELETE policies.

  ## Change
  - Drop the permissive members_insert policy
  - Replace with admins_insert restricted to owner/admin roles only
*/

DROP POLICY IF EXISTS "members_insert" ON business_settings;

CREATE POLICY "admins_insert"
  ON business_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(organization_id));
