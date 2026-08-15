/*
  # Allow managers to write production rates

  ## Summary
  Expands the INSERT and UPDATE RLS policies on team_member_production_rates to also
  allow users with the 'manager' role to create and update production rates.

  This is needed so that managers can enter inline production rates directly from
  the Job Creation modal without requiring owner/admin access.

  ## Changes
  - DROP existing INSERT policy (owner/admin only)
  - DROP existing UPDATE policy (owner/admin only)
  - CREATE new INSERT policy that includes owner, admin, and manager roles
  - CREATE new UPDATE policy that includes owner, admin, and manager roles
*/

DROP POLICY IF EXISTS "Org admins can insert production rates" ON team_member_production_rates;
DROP POLICY IF EXISTS "Org admins can update production rates" ON team_member_production_rates;

CREATE POLICY "Org admins and managers can insert production rates"
  ON team_member_production_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = team_member_production_rates.organization_id
        AND organization_members.user_id = (SELECT auth.uid())
        AND organization_members.role = ANY (ARRAY['owner', 'admin', 'manager'])
    )
  );

CREATE POLICY "Org admins and managers can update production rates"
  ON team_member_production_rates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = team_member_production_rates.organization_id
        AND organization_members.user_id = (SELECT auth.uid())
        AND organization_members.role = ANY (ARRAY['owner', 'admin', 'manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = team_member_production_rates.organization_id
        AND organization_members.user_id = (SELECT auth.uid())
        AND organization_members.role = ANY (ARRAY['owner', 'admin', 'manager'])
    )
  );
