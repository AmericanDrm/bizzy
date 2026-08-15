/*
  # Fix Foreign Key Indexes and RLS Performance Issues

  1. Foreign Key Indexes
    - Add indexes for all unindexed foreign keys across all tables
    - This improves JOIN and DELETE cascade performance

  2. RLS Policy Fixes
    - Fix `crew_live_locations` policy to use `(select auth.uid())` pattern
    - Fix `tenant_email_settings` policies to use `(select auth.uid())` pattern
    - Remove duplicate permissive policy on `crew_live_locations`

  3. Function Fixes
    - Fix `update_tenant_email_settings_updated_at` function search_path

  4. Cleanup
    - Drop unused indexes to reduce storage and maintenance overhead
*/

-- ============================================================================
-- PART 1: ADD FOREIGN KEY INDEXES
-- ============================================================================

-- break_entries
CREATE INDEX IF NOT EXISTS idx_break_entries_organization_id ON public.break_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_break_entries_user_id ON public.break_entries(user_id);

-- checklist_template_items
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_checklist_template_id ON public.checklist_template_items(checklist_template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template_id ON public.checklist_template_items(template_id);

-- checklist_templates
CREATE INDEX IF NOT EXISTS idx_checklist_templates_created_by ON public.checklist_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_job_type_id ON public.checklist_templates(job_type_id);

-- client_addresses
CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON public.client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_organization_id ON public.client_addresses(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_user_id ON public.client_addresses(user_id);

-- client_job_history
CREATE INDEX IF NOT EXISTS idx_client_job_history_organization_id ON public.client_job_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_schedule_event_id ON public.client_job_history(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_service_package_id ON public.client_job_history(service_package_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_time_entry_id ON public.client_job_history(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_user_id ON public.client_job_history(user_id);

-- client_photos
CREATE INDEX IF NOT EXISTS idx_client_photos_checklist_item_id ON public.client_photos(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_organization_id ON public.client_photos(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_productivity_session_id ON public.client_photos(productivity_session_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_user_id ON public.client_photos(user_id);

-- client_reminders
CREATE INDEX IF NOT EXISTS idx_client_reminders_client_id ON public.client_reminders(client_id);

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients(organization_id);

-- estimate_items
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON public.estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_job_type_id ON public.estimate_items(job_type_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_organization_id ON public.estimate_items(organization_id);

-- estimates
CREATE INDEX IF NOT EXISTS idx_estimates_client_id ON public.estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_estimates_organization_id ON public.estimates(organization_id);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON public.estimates(user_id);

-- expenses
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_parent_expense_id ON public.expenses(parent_expense_id);

-- faq_analytics
CREATE INDEX IF NOT EXISTS idx_faq_analytics_user_id ON public.faq_analytics(user_id);

-- income
CREATE INDEX IF NOT EXISTS idx_income_client_id ON public.income(client_id);
CREATE INDEX IF NOT EXISTS idx_income_job_id ON public.income(job_id);
CREATE INDEX IF NOT EXISTS idx_income_organization_id ON public.income(organization_id);
CREATE INDEX IF NOT EXISTS idx_income_user_id ON public.income(user_id);

-- invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_job_type_id ON public.invoice_items(job_type_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_organization_id ON public.invoice_items(organization_id);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);

-- job_checklist_items (column is checklist_id, not job_checklist_id)
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_completed_by ON public.job_checklist_items(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_checklist_id ON public.job_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_organization_id ON public.job_checklist_items(organization_id);

-- job_checklists
CREATE INDEX IF NOT EXISTS idx_job_checklists_created_by ON public.job_checklists(created_by);
CREATE INDEX IF NOT EXISTS idx_job_checklists_job_id ON public.job_checklists(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checklists_note_id ON public.job_checklists(note_id);
CREATE INDEX IF NOT EXISTS idx_job_checklists_organization_id ON public.job_checklists(organization_id);

-- job_service_packages
CREATE INDEX IF NOT EXISTS idx_job_service_packages_organization_id ON public.job_service_packages(organization_id);

-- job_supplies
CREATE INDEX IF NOT EXISTS idx_job_supplies_created_by ON public.job_supplies(created_by);
CREATE INDEX IF NOT EXISTS idx_job_supplies_job_id ON public.job_supplies(job_id);
CREATE INDEX IF NOT EXISTS idx_job_supplies_note_id ON public.job_supplies(note_id);
CREATE INDEX IF NOT EXISTS idx_job_supplies_organization_id ON public.job_supplies(organization_id);

-- job_types
CREATE INDEX IF NOT EXISTS idx_job_types_organization_id ON public.job_types(organization_id);

-- jobs
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_organization_id ON public.jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);

-- location_tracking
CREATE INDEX IF NOT EXISTS idx_location_tracking_schedule_event_id ON public.location_tracking(schedule_event_id);

-- message_templates
CREATE INDEX IF NOT EXISTS idx_message_templates_organization_id ON public.message_templates(organization_id);

-- mileage_readings
CREATE INDEX IF NOT EXISTS idx_mileage_readings_organization_id ON public.mileage_readings(organization_id);
CREATE INDEX IF NOT EXISTS idx_mileage_readings_user_id ON public.mileage_readings(user_id);

-- mileage_trips
CREATE INDEX IF NOT EXISTS idx_mileage_trips_organization_id ON public.mileage_trips(organization_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_time_entry_id ON public.mileage_trips(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_user_id ON public.mileage_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_vehicle_id ON public.mileage_trips(vehicle_id);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_client_id ON public.notes(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_organization_id ON public.notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);

-- organization_members
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);

-- organizations
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

-- productivity_sessions
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_organization_id ON public.productivity_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_schedule_event_id ON public.productivity_sessions(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_time_entry_id ON public.productivity_sessions(time_entry_id);

-- push_notifications
CREATE INDEX IF NOT EXISTS idx_push_notifications_organization_id ON public.push_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON public.push_notifications(user_id);

-- push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_organization_id ON public.push_tokens(organization_id);

-- schedule_events
CREATE INDEX IF NOT EXISTS idx_schedule_events_assigned_to ON public.schedule_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_schedule_events_client_id ON public.schedule_events(client_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_converted_from_estimate_id ON public.schedule_events(converted_from_estimate_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job_id ON public.schedule_events(job_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job_type_id ON public.schedule_events(job_type_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_organization_id ON public.schedule_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_parent_event_id ON public.schedule_events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_service_package_id ON public.schedule_events(service_package_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_user_id ON public.schedule_events(user_id);

-- sent_messages
CREATE INDEX IF NOT EXISTS idx_sent_messages_client_id ON public.sent_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_job_id ON public.sent_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_organization_id ON public.sent_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_schedule_event_id ON public.sent_messages(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_user_id ON public.sent_messages(user_id);

-- supplies_library
CREATE INDEX IF NOT EXISTS idx_supplies_library_organization_id ON public.supplies_library(organization_id);

-- team_notes
CREATE INDEX IF NOT EXISTS idx_team_notes_author_id ON public.team_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_organization_id ON public.team_notes(organization_id);

-- time_entries
CREATE INDEX IF NOT EXISTS idx_time_entries_vehicle_id ON public.time_entries(vehicle_id);

-- todos
CREATE INDEX IF NOT EXISTS idx_todos_client_id ON public.todos(client_id);
CREATE INDEX IF NOT EXISTS idx_todos_organization_id ON public.todos(organization_id);

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON public.user_roles(assigned_by);

-- vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id ON public.vehicles(organization_id);

-- walkthrough_analytics
CREATE INDEX IF NOT EXISTS idx_walkthrough_analytics_user_id ON public.walkthrough_analytics(user_id);

-- work_orders
CREATE INDEX IF NOT EXISTS idx_work_orders_schedule_event_id ON public.work_orders(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_user_id ON public.work_orders(user_id);

-- ============================================================================
-- PART 2: FIX RLS POLICIES WITH auth.<function>() PATTERN
-- ============================================================================

-- Fix crew_live_locations policy - use (select auth.uid()) pattern
DROP POLICY IF EXISTS "Managers and above can view org live locations" ON public.crew_live_locations;
CREATE POLICY "Managers and above can view org live locations"
  ON public.crew_live_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.organization_id = crew_live_locations.organization_id
        AND om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- Remove duplicate permissive policy to fix multiple permissive policies issue
DROP POLICY IF EXISTS "members_select" ON public.crew_live_locations;

-- Fix tenant_email_settings policies - use (select auth.uid()) pattern
DROP POLICY IF EXISTS "Org owners can delete email settings" ON public.tenant_email_settings;
DROP POLICY IF EXISTS "Org owners can insert email settings" ON public.tenant_email_settings;
DROP POLICY IF EXISTS "Org owners can update email settings" ON public.tenant_email_settings;
DROP POLICY IF EXISTS "Org owners can view email settings" ON public.tenant_email_settings;

CREATE POLICY "Org owners can view email settings"
  ON public.tenant_email_settings
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Org owners can insert email settings"
  ON public.tenant_email_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Org owners can update email settings"
  ON public.tenant_email_settings
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Org owners can delete email settings"
  ON public.tenant_email_settings
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = (select auth.uid())
    )
  );

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH PATH
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_tenant_email_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 4: DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS public.idx_checklist_templates_org_id;
DROP INDEX IF EXISTS public.idx_checklist_template_items_org_fk;
DROP INDEX IF EXISTS public.idx_client_photos_deleted_by_fk;
DROP INDEX IF EXISTS public.idx_client_reminders_created_by_fk;
DROP INDEX IF EXISTS public.idx_client_reminders_job_type_fk;
DROP INDEX IF EXISTS public.idx_client_reminders_service_package_fk;
DROP INDEX IF EXISTS public.idx_job_checklist_items_created_by_fk;
DROP INDEX IF EXISTS public.idx_sent_messages_reminder_fk;
