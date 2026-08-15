/*
  # Update RLS Policies for Organization-Based Isolation

  ## Critical Security Update
  This migration replaces ALL existing RLS policies with organization-based policies.
  Users can ONLY see data from organizations they belong to.
*/

-- DROP ALL existing insecure policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN (
      'clients', 'jobs', 'job_types', 'schedule_events', 'time_entries',
      'notes', 'todos', 'invoices', 'invoice_items', 'estimates', 'estimate_items',
      'income', 'expenses', 'message_templates', 'client_photos', 'sent_messages',
      'job_service_packages', 'client_job_history', 'productivity_sessions',
      'location_tracking', 'detected_locations', 'clock_out_prompts'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- CLIENTS POLICIES
CREATE POLICY "Organization members can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- JOBS POLICIES
CREATE POLICY "Organization members can view jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- JOB TYPES POLICIES
CREATE POLICY "Organization members can view job types"
  ON job_types FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert job types"
  ON job_types FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update job types"
  ON job_types FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete job types"
  ON job_types FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- SCHEDULE EVENTS POLICIES
CREATE POLICY "Organization members can view schedule events"
  ON schedule_events FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert schedule events"
  ON schedule_events FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update schedule events"
  ON schedule_events FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete schedule events"
  ON schedule_events FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- TIME ENTRIES POLICIES
CREATE POLICY "Organization members can view time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete time entries"
  ON time_entries FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- NOTES POLICIES
CREATE POLICY "Organization members can view notes"
  ON notes FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete notes"
  ON notes FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- TODOS POLICIES
CREATE POLICY "Organization members can view todos"
  ON todos FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert todos"
  ON todos FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update todos"
  ON todos FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete todos"
  ON todos FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- INVOICES POLICIES
CREATE POLICY "Organization members can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- INVOICE ITEMS POLICIES
CREATE POLICY "Organization members can view invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND user_is_org_member(invoices.organization_id)
    )
  );

CREATE POLICY "Organization members can insert invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND user_is_org_member(invoices.organization_id)
    )
  );

CREATE POLICY "Organization members can update invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND user_is_org_member(invoices.organization_id)
    )
  );

CREATE POLICY "Organization members can delete invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND user_is_org_member(invoices.organization_id)
    )
  );

-- ESTIMATES POLICIES
CREATE POLICY "Organization members can view estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert estimates"
  ON estimates FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update estimates"
  ON estimates FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete estimates"
  ON estimates FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- ESTIMATE ITEMS POLICIES
CREATE POLICY "Organization members can view estimate items"
  ON estimate_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_items.estimate_id
      AND user_is_org_member(estimates.organization_id)
    )
  );

CREATE POLICY "Organization members can insert estimate items"
  ON estimate_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_items.estimate_id
      AND user_is_org_member(estimates.organization_id)
    )
  );

CREATE POLICY "Organization members can update estimate items"
  ON estimate_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_items.estimate_id
      AND user_is_org_member(estimates.organization_id)
    )
  );

CREATE POLICY "Organization members can delete estimate items"
  ON estimate_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_items.estimate_id
      AND user_is_org_member(estimates.organization_id)
    )
  );

-- INCOME POLICIES
CREATE POLICY "Organization members can view income"
  ON income FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert income"
  ON income FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update income"
  ON income FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete income"
  ON income FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- EXPENSES POLICIES
CREATE POLICY "Organization members can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- MESSAGE TEMPLATES POLICIES
CREATE POLICY "Organization members can view message templates"
  ON message_templates FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert message templates"
  ON message_templates FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update message templates"
  ON message_templates FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete message templates"
  ON message_templates FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- CLIENT PHOTOS POLICIES
CREATE POLICY "Organization members can view client photos"
  ON client_photos FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert client photos"
  ON client_photos FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update client photos"
  ON client_photos FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete client photos"
  ON client_photos FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- SENT MESSAGES POLICIES
CREATE POLICY "Organization members can view sent messages"
  ON sent_messages FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert sent messages"
  ON sent_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update sent messages"
  ON sent_messages FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete sent messages"
  ON sent_messages FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- JOB SERVICE PACKAGES POLICIES
CREATE POLICY "Organization members can view job service packages"
  ON job_service_packages FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert job service packages"
  ON job_service_packages FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update job service packages"
  ON job_service_packages FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete job service packages"
  ON job_service_packages FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- CLIENT JOB HISTORY POLICIES
CREATE POLICY "Organization members can view client job history"
  ON client_job_history FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert client job history"
  ON client_job_history FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update client job history"
  ON client_job_history FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete client job history"
  ON client_job_history FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- PRODUCTIVITY SESSIONS POLICIES
CREATE POLICY "Organization members can view productivity sessions"
  ON productivity_sessions FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert productivity sessions"
  ON productivity_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update productivity sessions"
  ON productivity_sessions FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete productivity sessions"
  ON productivity_sessions FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- LOCATION TRACKING POLICIES
CREATE POLICY "Organization members can view location tracking"
  ON location_tracking FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert location tracking"
  ON location_tracking FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update location tracking"
  ON location_tracking FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete location tracking"
  ON location_tracking FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- DETECTED LOCATIONS POLICIES
CREATE POLICY "Organization members can view detected locations"
  ON detected_locations FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert detected locations"
  ON detected_locations FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update detected locations"
  ON detected_locations FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete detected locations"
  ON detected_locations FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));

-- CLOCK OUT PROMPTS POLICIES
CREATE POLICY "Organization members can view clock out prompts"
  ON clock_out_prompts FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization members can insert clock out prompts"
  ON clock_out_prompts FOR INSERT
  TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can update clock out prompts"
  ON clock_out_prompts FOR UPDATE
  TO authenticated
  USING (user_is_org_member(organization_id))
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Organization members can delete clock out prompts"
  ON clock_out_prompts FOR DELETE
  TO authenticated
  USING (user_is_org_member(organization_id));
