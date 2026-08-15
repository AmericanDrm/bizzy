
/*
  # Fix Remaining Multiple Permissive Policies

  ## Summary
  Consolidates multiple permissive SELECT/UPDATE/INSERT policies on the same tables
  that Supabase flags as performance issues. Multiple permissive policies for the
  same role/action are OR'd together causing redundant evaluations.

  ## Tables Fixed
  1. `client_work_requests` UPDATE - consolidates org members + portal clients
  2. `clients` SELECT - consolidates org members + portal client view
  3. `estimates` SELECT - consolidates org members + portal client view
  4. `invoices` SELECT - consolidates org members + portal client view
  5. `portal_messages` INSERT - consolidates org members + portal clients
  6. `portal_messages` SELECT - consolidates org members + portal clients
  7. `portal_messages` UPDATE - consolidates org members + portal clients
  8. `schedule_events` SELECT - consolidates org members + portal client view

  ## Approach
  Each pair of permissive policies is replaced with a single policy using OR
  conditions, preserving all existing access patterns exactly.
*/

-- ============================================================
-- 1. client_work_requests UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Org members can update work requests for their org" ON client_work_requests;
DROP POLICY IF EXISTS "Portal clients can cancel their own requests" ON client_work_requests;

CREATE POLICY "Authenticated users can update work requests"
  ON client_work_requests
  FOR UPDATE
  TO authenticated
  USING (
    (organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM client_portal_accounts
      WHERE client_portal_accounts.id = client_work_requests.portal_account_id
        AND client_portal_accounts.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 2. clients SELECT
-- ============================================================
DROP POLICY IF EXISTS "members_select" ON clients;
DROP POLICY IF EXISTS "portal_client_view_own_profile" ON clients;

CREATE POLICY "Authenticated users can view clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    is_org_member(organization_id)
    OR id = get_portal_client_id()
  );

-- ============================================================
-- 3. estimates SELECT
-- ============================================================
DROP POLICY IF EXISTS "members_select" ON estimates;
DROP POLICY IF EXISTS "portal_client_view_own_estimates" ON estimates;

CREATE POLICY "Authenticated users can view estimates"
  ON estimates
  FOR SELECT
  TO authenticated
  USING (
    is_org_member(organization_id)
    OR (client_id IS NOT NULL AND client_id = get_portal_client_id())
  );

-- ============================================================
-- 4. invoices SELECT
-- ============================================================
DROP POLICY IF EXISTS "members_select" ON invoices;
DROP POLICY IF EXISTS "portal_client_view_own_invoices" ON invoices;

CREATE POLICY "Authenticated users can view invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    is_org_member(organization_id)
    OR (client_id IS NOT NULL AND client_id = get_portal_client_id())
  );

-- ============================================================
-- 5. portal_messages INSERT
-- ============================================================
DROP POLICY IF EXISTS "Org members can send portal messages" ON portal_messages;
DROP POLICY IF EXISTS "Portal clients can send messages" ON portal_messages;

CREATE POLICY "Authenticated users can send portal messages"
  ON portal_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      sender_type = 'org'
      AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = portal_messages.organization_id
          AND organization_members.user_id = (SELECT auth.uid())
      )
    )
    OR
    (
      sender_type = 'client'
      AND EXISTS (
        SELECT 1 FROM client_portal_accounts
        WHERE client_portal_accounts.id = portal_messages.portal_account_id
          AND client_portal_accounts.user_id = (SELECT auth.uid())
      )
    )
  );

-- ============================================================
-- 6. portal_messages SELECT
-- ============================================================
DROP POLICY IF EXISTS "Org members can view portal messages" ON portal_messages;
DROP POLICY IF EXISTS "Portal clients can view their messages" ON portal_messages;

CREATE POLICY "Authenticated users can view portal messages"
  ON portal_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = portal_messages.organization_id
        AND organization_members.user_id = (SELECT auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM client_portal_accounts
      WHERE client_portal_accounts.id = portal_messages.portal_account_id
        AND client_portal_accounts.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 7. portal_messages UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Org members can update portal messages" ON portal_messages;
DROP POLICY IF EXISTS "Portal clients can mark messages read" ON portal_messages;

CREATE POLICY "Authenticated users can update portal messages"
  ON portal_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = portal_messages.organization_id
        AND organization_members.user_id = (SELECT auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM client_portal_accounts
      WHERE client_portal_accounts.id = portal_messages.portal_account_id
        AND client_portal_accounts.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 8. schedule_events SELECT
-- ============================================================
DROP POLICY IF EXISTS "members_select" ON schedule_events;
DROP POLICY IF EXISTS "portal_client_view_own_schedule" ON schedule_events;

CREATE POLICY "Authenticated users can view schedule events"
  ON schedule_events
  FOR SELECT
  TO authenticated
  USING (
    is_org_member(organization_id)
    OR (client_id IS NOT NULL AND client_id = get_portal_client_id())
  );
