/*
  # Restrict Members from Viewing Other Members on Crew Tracker

  ## Overview
  Updates the crew_live_locations RLS policies to prevent regular members from
  viewing other members' locations in the crew tracker. Owners, admins, and 
  managers can still view all crew locations.

  ## Changes
  - Drop existing "All org members can view org live locations" policy
  - Create new policy allowing owners/admins/managers to view all org locations
  - Existing "Users can view own live location" policy already covers members viewing themselves

  ## Security
  - Maintains security by requiring organization membership with appropriate role
  - Regular members can only view their own location
  - Owners, admins, and managers can view all crew locations within their organization
*/

-- Drop the permissive policy
DROP POLICY IF EXISTS "All org members can view org live locations" ON crew_live_locations;

-- Create new policy that only allows managers and above to view all crew locations
CREATE POLICY "Managers and above can view org live locations"
  ON crew_live_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = crew_live_locations.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );