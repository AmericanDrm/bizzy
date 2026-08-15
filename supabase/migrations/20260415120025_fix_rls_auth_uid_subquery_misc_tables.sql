/*
  # Fix RLS Auth UID Subquery - misc tables

  Replaces auth.uid() with (select auth.uid()) in RLS policies for:
  - quick_send_templates, organization_lifecycle_emails, getting_started_progress
  - geofence_job_sessions, time_entry_week_locks, oil_changes
  - client_work_requests, document_templates
*/

-- quick_send_templates
DROP POLICY IF EXISTS "Org members can delete quick send templates" ON public.quick_send_templates;
DROP POLICY IF EXISTS "Org members can insert quick send templates" ON public.quick_send_templates;
DROP POLICY IF EXISTS "Org members can select quick send templates" ON public.quick_send_templates;
DROP POLICY IF EXISTS "Org members can update quick send templates" ON public.quick_send_templates;

CREATE POLICY "Org members can delete quick send templates" ON public.quick_send_templates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = quick_send_templates.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert quick send templates" ON public.quick_send_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = quick_send_templates.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can select quick send templates" ON public.quick_send_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = quick_send_templates.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update quick send templates" ON public.quick_send_templates FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = quick_send_templates.organization_id AND user_id = (SELECT auth.uid())));

-- organization_lifecycle_emails
DROP POLICY IF EXISTS "Org owners can view their lifecycle emails" ON public.organization_lifecycle_emails;

CREATE POLICY "Org owners can view their lifecycle emails" ON public.organization_lifecycle_emails FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = organization_lifecycle_emails.organization_id AND user_id = (SELECT auth.uid()) AND role = 'owner'));

-- getting_started_progress
DROP POLICY IF EXISTS "Org members can view getting started progress" ON public.getting_started_progress;
DROP POLICY IF EXISTS "Owners and managers can insert getting started progress" ON public.getting_started_progress;
DROP POLICY IF EXISTS "Owners and managers can update getting started progress" ON public.getting_started_progress;
DROP POLICY IF EXISTS "Owners can delete getting started progress" ON public.getting_started_progress;

CREATE POLICY "Org members can view getting started progress" ON public.getting_started_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = getting_started_progress.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Owners and managers can insert getting started progress" ON public.getting_started_progress FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = getting_started_progress.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Owners and managers can update getting started progress" ON public.getting_started_progress FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = getting_started_progress.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Owners can delete getting started progress" ON public.getting_started_progress FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = getting_started_progress.organization_id AND user_id = (SELECT auth.uid()) AND role = 'owner'));

-- geofence_job_sessions
DROP POLICY IF EXISTS "Managers can update org geofence sessions" ON public.geofence_job_sessions;
DROP POLICY IF EXISTS "Managers can view org geofence sessions" ON public.geofence_job_sessions;
DROP POLICY IF EXISTS "Users can insert own geofence sessions" ON public.geofence_job_sessions;
DROP POLICY IF EXISTS "Users can update own geofence sessions" ON public.geofence_job_sessions;
DROP POLICY IF EXISTS "Users can view own geofence sessions" ON public.geofence_job_sessions;

CREATE POLICY "Managers can update org geofence sessions" ON public.geofence_job_sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = geofence_job_sessions.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Managers can view org geofence sessions" ON public.geofence_job_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = geofence_job_sessions.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Users can insert own geofence sessions" ON public.geofence_job_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own geofence sessions" ON public.geofence_job_sessions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own geofence sessions" ON public.geofence_job_sessions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- time_entry_week_locks
DROP POLICY IF EXISTS "Managers can create week locks" ON public.time_entry_week_locks;
DROP POLICY IF EXISTS "Managers can delete week locks" ON public.time_entry_week_locks;
DROP POLICY IF EXISTS "Members can view week locks for their org" ON public.time_entry_week_locks;

CREATE POLICY "Managers can create week locks" ON public.time_entry_week_locks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = time_entry_week_locks.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Managers can delete week locks" ON public.time_entry_week_locks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = time_entry_week_locks.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Members can view week locks for their org" ON public.time_entry_week_locks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = time_entry_week_locks.organization_id AND user_id = (SELECT auth.uid())));

-- oil_changes
DROP POLICY IF EXISTS "Users can delete own oil changes" ON public.oil_changes;
DROP POLICY IF EXISTS "Users can insert own oil changes" ON public.oil_changes;
DROP POLICY IF EXISTS "Users can update own oil changes" ON public.oil_changes;
DROP POLICY IF EXISTS "Users can view own oil changes" ON public.oil_changes;

CREATE POLICY "Users can delete own oil changes" ON public.oil_changes FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own oil changes" ON public.oil_changes FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own oil changes" ON public.oil_changes FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own oil changes" ON public.oil_changes FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM organization_members WHERE organization_id = oil_changes.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

-- client_work_requests portal cancel policy
DROP POLICY IF EXISTS "Portal clients can cancel their own requests" ON public.client_work_requests;

CREATE POLICY "Portal clients can cancel their own requests" ON public.client_work_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM client_portal_accounts WHERE id = client_work_requests.portal_account_id AND user_id = (SELECT auth.uid())));

-- document_templates
DROP POLICY IF EXISTS "Admins and managers can delete document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Admins and managers can insert document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Admins and managers can update document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Org members can view document templates" ON public.document_templates;

CREATE POLICY "Admins and managers can delete document templates" ON public.document_templates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = document_templates.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Admins and managers can insert document templates" ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = document_templates.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Admins and managers can update document templates" ON public.document_templates FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = document_templates.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Org members can view document templates" ON public.document_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = document_templates.organization_id AND user_id = (SELECT auth.uid())));
