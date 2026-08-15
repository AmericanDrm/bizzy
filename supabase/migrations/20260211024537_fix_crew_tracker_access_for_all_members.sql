/*
  # Fix Crew Tracker Access for All Organization Members

  ## Overview
  Updates the crew_live_locations RLS policies to allow all organization members
  (including owners) to view crew locations, not just admins.

  ## Changes
  - Drop existing "Admins can view org live locations" policy
  - Create new "All org members can view org live locations" policy
  - This allows owners, admins, managers, and members to view crew locations

  ## Security
  - Maintains security by requiring organization membership
  - Users can still only insert/update/delete their own location records
  - All members can view all crew locations within their organization
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admins can view org live locations" ON crew_live_locations;

-- Create new policy that allows all org members to view crew locations
CREATE POLICY "All org members can view org live locations"
  ON crew_live_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = crew_live_locations.organization_id
        AND om.user_id = auth.uid()
    )
  );