/*
  # Fix client_addresses INSERT RLS policy

  ## Problem
  The existing `members_insert` policy uses `WITH CHECK (is_org_member(organization_id))`
  but the `set_client_address_org_id` trigger populates `organization_id` AFTER the
  WITH CHECK evaluation, so every insert is rejected silently.

  ## Fix
  Replace the insert policy to check membership via the client record's organization_id
  instead of the row's organization_id (which hasn't been set yet at WITH CHECK time).
  This allows the trigger to fire and populate organization_id correctly.

  1. Drop the broken policy
  2. Add a new policy that checks org membership via the client_id's organization
*/

DROP POLICY IF EXISTS "members_insert" ON client_addresses;

CREATE POLICY "members_insert"
  ON client_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = client_id
        AND om.user_id = auth.uid()
    )
  );
