/*
  # Fix Comprehensive Security and Performance Issues

  This migration addresses multiple security and performance concerns:

  ## 1. Unindexed Foreign Keys
  Adds indexes for all foreign key columns that lack covering indexes.
  This dramatically improves JOIN performance and foreign key constraint checking.
  
  Tables affected:
  - address_suggestions_cache, ai_prompt_templates, break_entries
  - checklist_template_items, checklist_templates, client_addresses
  - client_job_history, client_job_quantities, client_photos
  - client_reminders, client_unit_quantities, clients
  - estimate_approval_tokens, estimate_items, estimates
  - expenses, faq_analytics, income, invoice_items, invoices
  - job_checklist_items, job_checklists, job_service_packages
  - job_supplies, job_type_defaults, job_types, jobs
  - location_tracking, message_templates, mileage_readings
  - mileage_trips, notes, organization_members, organizations
  - productivity_sessions, push_notifications, push_tokens
  - schedule_event_team_members, schedule_events, sent_messages
  - sms_messages, supply_template_items, supply_templates
  - team_member_production_rates, team_notes, time_entries
  - todos, user_roles, vehicles, walkthrough_analytics, work_orders

  ## 2. RLS Policy Optimization
  Fixes todos table RLS policies to use subselect pattern for auth.uid()
  to avoid re-evaluation on each row, improving query performance at scale.

  ## 3. Unused Index Cleanup
  Removes unused indexes from todos table to reduce maintenance overhead.

  ## Performance Impact
  - Foreign key indexes: Dramatically speeds up JOIN operations
  - RLS optimization: Reduces CPU usage for row-level filtering
  - Index cleanup: Reduces storage and write overhead
*/

-- =====================================================
-- SECTION 1: Add Indexes for Foreign Keys
-- =====================================================

-- address_suggestions_cache
CREATE INDEX IF NOT EXISTS idx_address_suggestions_cache_organization_id 
  ON address_suggestions_cache(organization_id);

-- ai_prompt_templates
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_organization_id 
  ON ai_prompt_templates(organization_id);

-- break_entries
CREATE INDEX IF NOT EXISTS idx_break_entries_organization_id 
  ON break_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_break_entries_user_id 
  ON break_entries(user_id);

-- checklist_template_items
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_checklist_template_id 
  ON checklist_template_items(checklist_template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_organization_id 
  ON checklist_template_items(organization_id);

-- checklist_templates
CREATE INDEX IF NOT EXISTS idx_checklist_templates_created_by 
  ON checklist_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_job_type_id 
  ON checklist_templates(job_type_id);

-- client_addresses
CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id 
  ON client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_organization_id 
  ON client_addresses(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_user_id 
  ON client_addresses(user_id);

-- client_job_history
CREATE INDEX IF NOT EXISTS idx_client_job_history_organization_id 
  ON client_job_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_schedule_event_id 
  ON client_job_history(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_service_package_id 
  ON client_job_history(service_package_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_time_entry_id 
  ON client_job_history(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_user_id 
  ON client_job_history(user_id);

-- client_job_quantities
CREATE INDEX IF NOT EXISTS idx_client_job_quantities_job_type_id 
  ON client_job_quantities(job_type_id);
CREATE INDEX IF NOT EXISTS idx_client_job_quantities_organization_id 
  ON client_job_quantities(organization_id);

-- client_photos
CREATE INDEX IF NOT EXISTS idx_client_photos_checklist_item_id 
  ON client_photos(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_deleted_by 
  ON client_photos(deleted_by);
CREATE INDEX IF NOT EXISTS idx_client_photos_organization_id 
  ON client_photos(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_productivity_session_id 
  ON client_photos(productivity_session_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_user_id 
  ON client_photos(user_id);

-- client_reminders
CREATE INDEX IF NOT EXISTS idx_client_reminders_client_id 
  ON client_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_client_reminders_created_by 
  ON client_reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_client_reminders_job_type_id 
  ON client_reminders(job_type_id);
CREATE INDEX IF NOT EXISTS idx_client_reminders_service_package_id 
  ON client_reminders(service_package_id);

-- client_unit_quantities
CREATE INDEX IF NOT EXISTS idx_client_unit_quantities_job_type_id 
  ON client_unit_quantities(job_type_id);
CREATE INDEX IF NOT EXISTS idx_client_unit_quantities_organization_id 
  ON client_unit_quantities(organization_id);

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_organization_id 
  ON clients(organization_id);

-- estimate_approval_tokens
CREATE INDEX IF NOT EXISTS idx_estimate_approval_tokens_estimate_id 
  ON estimate_approval_tokens(estimate_id);

-- estimate_items
CREATE INDEX IF NOT EXISTS idx_estimate_items_job_type_id 
  ON estimate_items(job_type_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_organization_id 
  ON estimate_items(organization_id);

-- estimates
CREATE INDEX IF NOT EXISTS idx_estimates_client_id 
  ON estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_estimates_organization_id 
  ON estimates(organization_id);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id 
  ON estimates(user_id);

-- expenses
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id 
  ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_parent_expense_id 
  ON expenses(parent_expense_id);

-- faq_analytics
CREATE INDEX IF NOT EXISTS idx_faq_analytics_user_id 
  ON faq_analytics(user_id);

-- income
CREATE INDEX IF NOT EXISTS idx_income_client_id 
  ON income(client_id);
CREATE INDEX IF NOT EXISTS idx_income_job_id 
  ON income(job_id);
CREATE INDEX IF NOT EXISTS idx_income_organization_id 
  ON income(organization_id);
CREATE INDEX IF NOT EXISTS idx_income_user_id 
  ON income(user_id);

-- invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_job_type_id 
  ON invoice_items(job_type_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_organization_id 
  ON invoice_items(organization_id);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_client_id 
  ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id 
  ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id 
  ON invoices(user_id);

-- job_checklist_items
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_completed_by 
  ON job_checklist_items(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_created_by 
  ON job_checklist_items(created_by);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_organization_id 
  ON job_checklist_items(organization_id);

-- job_checklists
CREATE INDEX IF NOT EXISTS idx_job_checklists_created_by 
  ON job_checklists(created_by);
CREATE INDEX IF NOT EXISTS idx_job_checklists_job_id 
  ON job_checklists(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checklists_note_id 
  ON job_checklists(note_id);

-- job_service_packages
CREATE INDEX IF NOT EXISTS idx_job_service_packages_organization_id 
  ON job_service_packages(organization_id);

-- job_supplies
CREATE INDEX IF NOT EXISTS idx_job_supplies_created_by 
  ON job_supplies(created_by);
CREATE INDEX IF NOT EXISTS idx_job_supplies_job_id 
  ON job_supplies(job_id);
CREATE INDEX IF NOT EXISTS idx_job_supplies_note_id 
  ON job_supplies(note_id);

-- job_type_defaults
CREATE INDEX IF NOT EXISTS idx_job_type_defaults_job_type_id 
  ON job_type_defaults(job_type_id);
CREATE INDEX IF NOT EXISTS idx_job_type_defaults_organization_id 
  ON job_type_defaults(organization_id);

-- job_types
CREATE INDEX IF NOT EXISTS idx_job_types_organization_id 
  ON job_types(organization_id);

-- jobs
CREATE INDEX IF NOT EXISTS idx_jobs_client_id 
  ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_estimate_id 
  ON jobs(estimate_id);
CREATE INDEX IF NOT EXISTS idx_jobs_organization_id 
  ON jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id 
  ON jobs(user_id);

-- location_tracking
CREATE INDEX IF NOT EXISTS idx_location_tracking_schedule_event_id 
  ON location_tracking(schedule_event_id);

-- message_templates
CREATE INDEX IF NOT EXISTS idx_message_templates_organization_id 
  ON message_templates(organization_id);

-- mileage_readings
CREATE INDEX IF NOT EXISTS idx_mileage_readings_organization_id 
  ON mileage_readings(organization_id);
CREATE INDEX IF NOT EXISTS idx_mileage_readings_user_id 
  ON mileage_readings(user_id);

-- mileage_trips
CREATE INDEX IF NOT EXISTS idx_mileage_trips_organization_id 
  ON mileage_trips(organization_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_time_entry_id 
  ON mileage_trips(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_user_id 
  ON mileage_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_vehicle_id 
  ON mileage_trips(vehicle_id);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_client_id 
  ON notes(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_organization_id 
  ON notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id 
  ON notes(user_id);

-- organization_members
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id 
  ON organization_members(user_id);

-- organizations
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id 
  ON organizations(owner_id);

-- productivity_sessions
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_organization_id 
  ON productivity_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_schedule_event_id 
  ON productivity_sessions(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_time_entry_id 
  ON productivity_sessions(time_entry_id);

-- push_notifications
CREATE INDEX IF NOT EXISTS idx_push_notifications_organization_id 
  ON push_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id 
  ON push_notifications(user_id);

-- push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_organization_id 
  ON push_tokens(organization_id);

-- schedule_event_team_members
CREATE INDEX IF NOT EXISTS idx_schedule_event_team_members_member_id 
  ON schedule_event_team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_schedule_event_team_members_organization_id 
  ON schedule_event_team_members(organization_id);

-- schedule_events (10 foreign keys)
CREATE INDEX IF NOT EXISTS idx_schedule_events_assigned_to 
  ON schedule_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_schedule_events_client_id 
  ON schedule_events(client_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_converted_from_estimate_id 
  ON schedule_events(converted_from_estimate_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_estimate_id 
  ON schedule_events(estimate_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job_id 
  ON schedule_events(job_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job_type_id 
  ON schedule_events(job_type_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_organization_id 
  ON schedule_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_parent_event_id 
  ON schedule_events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_service_package_id 
  ON schedule_events(service_package_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_user_id 
  ON schedule_events(user_id);

-- sent_messages
CREATE INDEX IF NOT EXISTS idx_sent_messages_client_id 
  ON sent_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_job_id 
  ON sent_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_organization_id 
  ON sent_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_reminder_id 
  ON sent_messages(reminder_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_schedule_event_id 
  ON sent_messages(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_user_id 
  ON sent_messages(user_id);

-- sms_messages
CREATE INDEX IF NOT EXISTS idx_sms_messages_client_id 
  ON sms_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_organization_id 
  ON sms_messages(organization_id);

-- supply_template_items
CREATE INDEX IF NOT EXISTS idx_supply_template_items_organization_id 
  ON supply_template_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_supply_template_items_template_id 
  ON supply_template_items(template_id);

-- supply_templates
CREATE INDEX IF NOT EXISTS idx_supply_templates_created_by 
  ON supply_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_supply_templates_organization_id 
  ON supply_templates(organization_id);

-- team_member_production_rates
CREATE INDEX IF NOT EXISTS idx_team_member_production_rates_organization_id 
  ON team_member_production_rates(organization_id);

-- team_notes
CREATE INDEX IF NOT EXISTS idx_team_notes_author_id 
  ON team_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_organization_id 
  ON team_notes(organization_id);

-- time_entries
CREATE INDEX IF NOT EXISTS idx_time_entries_vehicle_id 
  ON time_entries(vehicle_id);

-- todos
CREATE INDEX IF NOT EXISTS idx_todos_organization_id 
  ON todos(organization_id);

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by 
  ON user_roles(assigned_by);

-- vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id 
  ON vehicles(organization_id);

-- walkthrough_analytics
CREATE INDEX IF NOT EXISTS idx_walkthrough_analytics_user_id 
  ON walkthrough_analytics(user_id);

-- work_orders
CREATE INDEX IF NOT EXISTS idx_work_orders_schedule_event_id 
  ON work_orders(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_user_id 
  ON work_orders(user_id);

-- =====================================================
-- SECTION 2: Remove Unused Indexes from todos table
-- =====================================================

DROP INDEX IF EXISTS idx_todos_client_id;
DROP INDEX IF EXISTS idx_todos_shared;

-- =====================================================
-- SECTION 3: Fix RLS Policies on todos table
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own or shared todos" ON todos;
DROP POLICY IF EXISTS "Users can insert own todos" ON todos;
DROP POLICY IF EXISTS "Users can update own todos v2" ON todos;
DROP POLICY IF EXISTS "Users can delete own todos v2" ON todos;

-- Recreate policies with optimized auth.uid() calls using subselects
-- This prevents re-evaluation of auth.uid() for each row, improving performance
CREATE POLICY "Users can view own or shared todos"
  ON todos FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR (is_shared_with_org = true AND organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = (select auth.uid())
    ))
  );

CREATE POLICY "Users can insert own todos"
  ON todos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own todos v2"
  ON todos FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own todos v2"
  ON todos FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
