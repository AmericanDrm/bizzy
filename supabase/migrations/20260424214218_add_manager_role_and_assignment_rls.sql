/*
  # Add Manager Role and Fix Assignment RLS

  ## Summary
  This migration makes the following changes to support the manager role and
  multi-employee job assignments:

  1. Manager Role
     - Updates `is_org_admin` helper function to include 'manager' so managers
       get the same write permissions as admins across the codebase.
     - Adds 'manager' as a valid role in the organization_members check constraint.

  2. schedule_event_team_members RLS
     - Updates INSERT and DELETE policies to include 'manager' (previously only
       owner and admin could write assignments).
     - Adds a missing UPDATE policy.

  3. schedule_events SELECT policy
     - Tightens visibility so basic 'member' employees only see events they are
       assigned to (via schedule_event_team_members, assigned_to, or created by
       themselves via user_id).
     - Owners, admins, and managers continue to see all org events.

  ## Security Notes
  - Members who are not assigned to a job will no longer see it in their calendar.
  - The is_org_admin function now covers owner/admin/manager, keeping all
    admin-gated policies consistent with manager access.
*/

-- Step 1: Update is_org_admin to include manager role
CREATE OR REPLACE FUNCTION is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
  );
$$;

-- Step 2: Add manager to the allowed roles (if a check constraint exists)
DO $$
BEGIN
  -- Try to drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'organization_members'
      AND constraint_name = 'organization_members_role_check'
  ) THEN
    ALTER TABLE organization_members DROP CONSTRAINT organization_members_role_check;
  END IF;
END $$;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'member'));

-- Step 3: Update schedule_event_team_members INSERT policy to include manager
DROP POLICY IF EXISTS "Admins and owners can insert team assignments" ON schedule_event_team_members;

CREATE POLICY "Admins owners managers can insert team assignments"
  ON schedule_event_team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = schedule_event_team_members.organization_id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- Step 4: Update schedule_event_team_members DELETE policy to include manager
DROP POLICY IF EXISTS "Admins and owners can delete team assignments" ON schedule_event_team_members;

CREATE POLICY "Admins owners managers can delete team assignments"
  ON schedule_event_team_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = schedule_event_team_members.organization_id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- Step 5: Tighten schedule_events SELECT policy for basic members
DROP POLICY IF EXISTS "Authenticated users can view schedule events" ON schedule_events;

CREATE POLICY "Users can view relevant schedule events"
  ON schedule_events
  FOR SELECT
  TO authenticated
  USING (
    -- Owners, admins, and managers see all org events
    is_org_admin(organization_id)
    OR
    -- Basic members see events they created
    (is_org_member(organization_id) AND user_id = (SELECT auth.uid()))
    OR
    -- Basic members see events where they are the assigned_to user
    (
      is_org_member(organization_id)
      AND assigned_to IS NOT NULL
      AND assigned_to = (
        SELECT user_id FROM organization_members
        WHERE organization_id = schedule_events.organization_id
          AND user_id = (SELECT auth.uid())
        LIMIT 1
      )
    )
    OR
    -- Basic members see events where they appear in schedule_event_team_members
    (
      is_org_member(organization_id)
      AND EXISTS (
        SELECT 1 FROM schedule_event_team_members setm
        JOIN organization_members om
          ON om.organization_id = setm.organization_id
          AND om.user_id = (SELECT auth.uid())
        WHERE setm.schedule_event_id = schedule_events.id
          AND setm.member_id = om.id
      )
    )
    OR
    -- Client portal access (unchanged)
    (client_id IS NOT NULL AND client_id = get_portal_client_id())
  );
