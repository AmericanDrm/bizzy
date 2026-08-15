/*
  # Fix RLS Auth Initialization Plan

  Replaces `auth.uid()` and `auth.role()` with `(select auth.uid())` and
  `(select auth.role())` in all affected policies so the auth function is
  evaluated once per statement instead of once per row.

  1. Modified Tables and Policies
    - `app_settings` - "Authenticated users can read app settings"
    - `app_versions` - "Authenticated users can read app versions"
    - `organization_subscriptions` - 2 policies (view, update)
    - `lifecycle_email_log` - "Org admins and owners can view lifecycle emails"
    - `appointment_reminders` - 4 policies (select, insert, update, delete)
    - `client_portal_accounts` - "org_members_read_portal_accounts"
    - `broadcast_templates` - 4 policies (select, insert, update, delete)
    - `client_work_requests` - 3 policies (update, portal insert, portal view)
    - `pane_types` - 4 policies (select, insert, update, delete)
    - `client_categories` - 3 policies (select, insert, delete)
    - `job_type_categories` - 4 policies (select, insert, update, delete)
    - `client_addresses` - "members_insert"
    - `break_policies` - 4 policies (select, insert, update, delete)
    - `checklist_item_photos` - 3 policies (select, insert, delete)

  2. Security
    - No functional changes to access control
    - Only optimization: auth functions wrapped in (select ...) subquery
*/

-- ============================================================
-- app_settings
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

-- ============================================================
-- app_versions
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read app versions" ON public.app_versions;
CREATE POLICY "Authenticated users can read app versions"
  ON public.app_versions FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

-- ============================================================
-- organization_subscriptions
-- ============================================================
DROP POLICY IF EXISTS "Org members can view their subscription" ON public.organization_subscriptions;
CREATE POLICY "Org members can view their subscription"
  ON public.organization_subscriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_subscriptions.organization_id
        AND organization_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org owners and admins can update subscription" ON public.organization_subscriptions;
CREATE POLICY "Org owners and admins can update subscription"
  ON public.organization_subscriptions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_subscriptions.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_subscriptions.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- lifecycle_email_log
-- ============================================================
DROP POLICY IF EXISTS "Org admins and owners can view lifecycle emails" ON public.lifecycle_email_log;
CREATE POLICY "Org admins and owners can view lifecycle emails"
  ON public.lifecycle_email_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = lifecycle_email_log.organization_id
        AND organization_members.user_id = (select auth.uid())
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- appointment_reminders
-- ============================================================
DROP POLICY IF EXISTS "Org members can view appointment reminders" ON public.appointment_reminders;
CREATE POLICY "Org members can view appointment reminders"
  ON public.appointment_reminders FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org admins can insert appointment reminders" ON public.appointment_reminders;
CREATE POLICY "Org admins can insert appointment reminders"
  ON public.appointment_reminders FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org admins can update appointment reminders" ON public.appointment_reminders;
CREATE POLICY "Org admins can update appointment reminders"
  ON public.appointment_reminders FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org admins can delete appointment reminders" ON public.appointment_reminders;
CREATE POLICY "Org admins can delete appointment reminders"
  ON public.appointment_reminders FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

-- ============================================================
-- client_portal_accounts
-- ============================================================
DROP POLICY IF EXISTS "org_members_read_portal_accounts" ON public.client_portal_accounts;
CREATE POLICY "org_members_read_portal_accounts"
  ON public.client_portal_accounts FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id) OR (user_id = (select auth.uid()))
  );

-- ============================================================
-- broadcast_templates
-- ============================================================
DROP POLICY IF EXISTS "Org members can select broadcast templates" ON public.broadcast_templates;
CREATE POLICY "Org members can select broadcast templates"
  ON public.broadcast_templates FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can insert broadcast templates" ON public.broadcast_templates;
CREATE POLICY "Org members can insert broadcast templates"
  ON public.broadcast_templates FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can update broadcast templates" ON public.broadcast_templates;
CREATE POLICY "Org members can update broadcast templates"
  ON public.broadcast_templates FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can delete broadcast templates" ON public.broadcast_templates;
CREATE POLICY "Org members can delete broadcast templates"
  ON public.broadcast_templates FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

-- ============================================================
-- client_work_requests
-- ============================================================
DROP POLICY IF EXISTS "Org members can update work requests for their org" ON public.client_work_requests;
CREATE POLICY "Org members can update work requests for their org"
  ON public.client_work_requests FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Portal clients can insert own work requests" ON public.client_work_requests;
CREATE POLICY "Portal clients can insert own work requests"
  ON public.client_work_requests FOR INSERT TO authenticated
  WITH CHECK (
    portal_account_id IN (
      SELECT cpa.id FROM client_portal_accounts cpa
      WHERE cpa.user_id = (select auth.uid()) AND cpa.is_active = true
    )
  );

DROP POLICY IF EXISTS "Portal clients can view own work requests" ON public.client_work_requests;
CREATE POLICY "Portal clients can view own work requests"
  ON public.client_work_requests FOR SELECT TO authenticated
  USING (
    portal_account_id IN (
      SELECT cpa.id FROM client_portal_accounts cpa
      WHERE cpa.user_id = (select auth.uid()) AND cpa.is_active = true
    )
    OR
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

-- ============================================================
-- pane_types
-- ============================================================
DROP POLICY IF EXISTS "Members can view org pane types" ON public.pane_types;
CREATE POLICY "Members can view org pane types"
  ON public.pane_types FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can insert pane types" ON public.pane_types;
CREATE POLICY "Admins can insert pane types"
  ON public.pane_types FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
        AND om.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins can update pane types" ON public.pane_types;
CREATE POLICY "Admins can update pane types"
  ON public.pane_types FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
        AND om.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
        AND om.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins can delete pane types" ON public.pane_types;
CREATE POLICY "Admins can delete pane types"
  ON public.pane_types FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
        AND om.role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- client_categories
-- ============================================================
DROP POLICY IF EXISTS "Org members can select client_categories" ON public.client_categories;
CREATE POLICY "Org members can select client_categories"
  ON public.client_categories FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can insert client_categories" ON public.client_categories;
CREATE POLICY "Org members can insert client_categories"
  ON public.client_categories FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can delete client_categories" ON public.client_categories;
CREATE POLICY "Org members can delete client_categories"
  ON public.client_categories FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

-- ============================================================
-- job_type_categories
-- ============================================================
DROP POLICY IF EXISTS "Org members can select job_type_categories" ON public.job_type_categories;
CREATE POLICY "Org members can select job_type_categories"
  ON public.job_type_categories FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can insert job_type_categories" ON public.job_type_categories;
CREATE POLICY "Org members can insert job_type_categories"
  ON public.job_type_categories FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can update job_type_categories" ON public.job_type_categories;
CREATE POLICY "Org members can update job_type_categories"
  ON public.job_type_categories FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can delete job_type_categories" ON public.job_type_categories;
CREATE POLICY "Org members can delete job_type_categories"
  ON public.job_type_categories FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

-- ============================================================
-- client_addresses
-- ============================================================
DROP POLICY IF EXISTS "members_insert" ON public.client_addresses;
CREATE POLICY "members_insert"
  ON public.client_addresses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = client_addresses.client_id
        AND om.user_id = (select auth.uid())
    )
  );

-- ============================================================
-- break_policies
-- ============================================================
DROP POLICY IF EXISTS "Org members can view break policies" ON public.break_policies;
CREATE POLICY "Org members can view break policies"
  ON public.break_policies FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and managers can insert break policies" ON public.break_policies;
CREATE POLICY "Admins and managers can insert break policies"
  ON public.break_policies FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins and managers can update break policies" ON public.break_policies;
CREATE POLICY "Admins and managers can update break policies"
  ON public.break_policies FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins and managers can delete break policies" ON public.break_policies;
CREATE POLICY "Admins and managers can delete break policies"
  ON public.break_policies FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ============================================================
-- checklist_item_photos
-- ============================================================
DROP POLICY IF EXISTS "Org members can view checklist item photos" ON public.checklist_item_photos;
CREATE POLICY "Org members can view checklist item photos"
  ON public.checklist_item_photos FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can insert checklist item photos" ON public.checklist_item_photos;
CREATE POLICY "Org members can insert checklist item photos"
  ON public.checklist_item_photos FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members can delete checklist item photos" ON public.checklist_item_photos;
CREATE POLICY "Org members can delete checklist item photos"
  ON public.checklist_item_photos FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = (select auth.uid())
    )
  );
