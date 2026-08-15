/*
  # Remove Unused Indexes and Fix Multiple Permissive Policies

  1. Security Improvements
    - Drop all unused indexes to reduce storage overhead and improve write performance
    - Fix multiple permissive policies by splitting admin policies into specific operations

  2. Index Removal
    - Remove 130+ unused indexes across all tables
    - Indexes are not being used by queries and consume unnecessary resources

  3. Policy Fixes
    - Split broad "FOR ALL" policies into specific INSERT/UPDATE/DELETE policies
    - Prevents multiple permissive SELECT policies from conflicting
    - Applies to: ai_prompt_templates, client_job_quantities

  4. Notes
    - Auth DB Connection Strategy cannot be fixed via migration (requires Supabase dashboard settings)
    - All indexes can be recreated if needed based on actual query patterns
*/

-- ============================================================================
-- FIX MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- Fix ai_prompt_templates: Split "Admins can manage" into separate policies
DROP POLICY IF EXISTS "Admins can manage AI prompt templates" ON ai_prompt_templates;

CREATE POLICY "Admins can insert AI prompt templates"
  ON ai_prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_prompt_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update AI prompt templates"
  ON ai_prompt_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_prompt_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_prompt_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete AI prompt templates"
  ON ai_prompt_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_prompt_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Fix client_job_quantities: Split "manage" into separate policies
DROP POLICY IF EXISTS "Organization members can manage client quantities" ON client_job_quantities;

CREATE POLICY "Organization members can insert client quantities"
  ON client_job_quantities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_job_quantities.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Organization members can update client quantities"
  ON client_job_quantities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_job_quantities.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_job_quantities.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Organization members can delete client quantities"
  ON client_job_quantities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_job_quantities.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- DROP UNUSED INDEXES - NEW FEATURE TABLES
-- ============================================================================

DROP INDEX IF EXISTS idx_job_type_defaults_org;
DROP INDEX IF EXISTS idx_job_type_defaults_job_type;
DROP INDEX IF EXISTS idx_ai_prompt_templates_org;
DROP INDEX IF EXISTS idx_ai_prompt_templates_category;
DROP INDEX IF EXISTS idx_address_cache_org;
DROP INDEX IF EXISTS idx_address_cache_search;
DROP INDEX IF EXISTS idx_address_cache_last_used;
DROP INDEX IF EXISTS idx_supply_templates_org;
DROP INDEX IF EXISTS idx_supply_templates_created_by;
DROP INDEX IF EXISTS idx_supply_template_items_template;
DROP INDEX IF EXISTS idx_supply_template_items_org;
DROP INDEX IF EXISTS idx_client_unit_quantities_job_type_id;
DROP INDEX IF EXISTS idx_client_unit_quantities_org_id;
DROP INDEX IF EXISTS idx_prod_rates_user_id;
DROP INDEX IF EXISTS idx_prod_rates_org_id;
DROP INDEX IF EXISTS idx_team_member_production_rates_unit_type_new;
DROP INDEX IF EXISTS idx_client_job_quantities_client_id;
DROP INDEX IF EXISTS idx_client_job_quantities_job_type_id;
DROP INDEX IF EXISTS idx_client_job_quantities_org_id;
DROP INDEX IF EXISTS idx_previous_addresses_org;
DROP INDEX IF EXISTS idx_schedule_event_team_members_event_id;
DROP INDEX IF EXISTS idx_schedule_event_team_members_member_id;
DROP INDEX IF EXISTS idx_schedule_event_team_members_org_id;

-- ============================================================================
-- DROP UNUSED INDEXES - SMS SYSTEM
-- ============================================================================

DROP INDEX IF EXISTS idx_tenant_sms_settings_phone;
DROP INDEX IF EXISTS idx_sms_messages_org;
DROP INDEX IF EXISTS idx_sms_messages_from;
DROP INDEX IF EXISTS idx_sms_messages_to;
DROP INDEX IF EXISTS idx_sms_messages_created;
DROP INDEX IF EXISTS idx_sms_messages_direction;
DROP INDEX IF EXISTS idx_sms_messages_client;
DROP INDEX IF EXISTS idx_sms_opt_status_org;
DROP INDEX IF EXISTS idx_sms_opt_status_phone;
DROP INDEX IF EXISTS idx_sms_opt_status_org_phone;

-- ============================================================================
-- DROP UNUSED INDEXES - CORE TABLES
-- ============================================================================

DROP INDEX IF EXISTS idx_break_entries_organization_id;
DROP INDEX IF EXISTS idx_break_entries_user_id;
DROP INDEX IF EXISTS idx_checklist_template_items_checklist_template_id;
DROP INDEX IF EXISTS idx_checklist_template_items_organization_id;
DROP INDEX IF EXISTS idx_checklist_templates_created_by;
DROP INDEX IF EXISTS idx_checklist_templates_job_type_id;
DROP INDEX IF EXISTS idx_client_addresses_client_id;
DROP INDEX IF EXISTS idx_client_addresses_organization_id;
DROP INDEX IF EXISTS idx_client_addresses_user_id;
DROP INDEX IF EXISTS idx_client_job_history_organization_id;
DROP INDEX IF EXISTS idx_client_job_history_schedule_event_id;
DROP INDEX IF EXISTS idx_client_job_history_service_package_id;
DROP INDEX IF EXISTS idx_client_job_history_time_entry_id;
DROP INDEX IF EXISTS idx_client_job_history_user_id;
DROP INDEX IF EXISTS idx_client_photos_checklist_item_id;
DROP INDEX IF EXISTS idx_client_photos_organization_id;
DROP INDEX IF EXISTS idx_client_photos_productivity_session_id;
DROP INDEX IF EXISTS idx_client_photos_user_id;
DROP INDEX IF EXISTS idx_client_photos_deleted_by;
DROP INDEX IF EXISTS idx_client_reminders_client_id;
DROP INDEX IF EXISTS idx_client_reminders_created_by;
DROP INDEX IF EXISTS idx_client_reminders_job_type_id;
DROP INDEX IF EXISTS idx_client_reminders_service_package_id;
DROP INDEX IF EXISTS idx_clients_organization_id;

-- ============================================================================
-- DROP UNUSED INDEXES - ESTIMATES & INVOICES
-- ============================================================================

DROP INDEX IF EXISTS idx_estimate_items_job_type_id;
DROP INDEX IF EXISTS idx_estimate_items_organization_id;
DROP INDEX IF EXISTS idx_estimates_client_id;
DROP INDEX IF EXISTS idx_estimates_organization_id;
DROP INDEX IF EXISTS idx_estimates_user_id;
DROP INDEX IF EXISTS idx_estimate_approval_tokens_token;
DROP INDEX IF EXISTS idx_estimate_approval_tokens_estimate_id;
DROP INDEX IF EXISTS idx_invoice_items_job_type_id;
DROP INDEX IF EXISTS idx_invoice_items_organization_id;
DROP INDEX IF EXISTS idx_invoices_client_id;
DROP INDEX IF EXISTS idx_invoices_organization_id;
DROP INDEX IF EXISTS idx_invoices_user_id;

-- ============================================================================
-- DROP UNUSED INDEXES - FINANCIAL TABLES
-- ============================================================================

DROP INDEX IF EXISTS idx_expenses_organization_id;
DROP INDEX IF EXISTS idx_expenses_parent_expense_id;
DROP INDEX IF EXISTS idx_income_client_id;
DROP INDEX IF EXISTS idx_income_job_id;
DROP INDEX IF EXISTS idx_income_organization_id;
DROP INDEX IF EXISTS idx_income_user_id;

-- ============================================================================
-- DROP UNUSED INDEXES - JOB SYSTEM
-- ============================================================================

DROP INDEX IF EXISTS idx_job_checklist_items_completed_by;
DROP INDEX IF EXISTS idx_job_checklist_items_organization_id;
DROP INDEX IF EXISTS idx_job_checklist_items_created_by_fkey;
DROP INDEX IF EXISTS idx_job_checklists_created_by;
DROP INDEX IF EXISTS idx_job_checklists_job_id;
DROP INDEX IF EXISTS idx_job_checklists_note_id;
DROP INDEX IF EXISTS idx_job_service_packages_organization_id;
DROP INDEX IF EXISTS idx_job_supplies_created_by;
DROP INDEX IF EXISTS idx_job_supplies_job_id;
DROP INDEX IF EXISTS idx_job_supplies_note_id;
DROP INDEX IF EXISTS idx_job_types_organization_id;
DROP INDEX IF EXISTS idx_jobs_client_id;
DROP INDEX IF EXISTS idx_jobs_organization_id;
DROP INDEX IF EXISTS idx_jobs_user_id;
DROP INDEX IF EXISTS idx_jobs_estimate_id;

-- ============================================================================
-- DROP UNUSED INDEXES - LOCATION & TRACKING
-- ============================================================================

DROP INDEX IF EXISTS idx_location_tracking_schedule_event_id;
DROP INDEX IF EXISTS idx_mileage_readings_organization_id;
DROP INDEX IF EXISTS idx_mileage_readings_user_id;
DROP INDEX IF EXISTS idx_mileage_trips_organization_id;
DROP INDEX IF EXISTS idx_mileage_trips_time_entry_id;
DROP INDEX IF EXISTS idx_mileage_trips_user_id;
DROP INDEX IF EXISTS idx_mileage_trips_vehicle_id;
DROP INDEX IF EXISTS idx_vehicles_organization_id;
DROP INDEX IF EXISTS idx_time_entries_vehicle_id;

-- ============================================================================
-- DROP UNUSED INDEXES - MESSAGING & NOTIFICATIONS
-- ============================================================================

DROP INDEX IF EXISTS idx_message_templates_organization_id;
DROP INDEX IF EXISTS idx_sent_messages_client_id;
DROP INDEX IF EXISTS idx_sent_messages_job_id;
DROP INDEX IF EXISTS idx_sent_messages_organization_id;
DROP INDEX IF EXISTS idx_sent_messages_schedule_event_id;
DROP INDEX IF EXISTS idx_sent_messages_user_id;
DROP INDEX IF EXISTS idx_sent_messages_reminder_id;
DROP INDEX IF EXISTS idx_push_notifications_organization_id;
DROP INDEX IF EXISTS idx_push_notifications_user_id;
DROP INDEX IF EXISTS idx_push_tokens_organization_id;

-- ============================================================================
-- DROP UNUSED INDEXES - NOTES & ORGANIZATION
-- ============================================================================

DROP INDEX IF EXISTS idx_notes_client_id;
DROP INDEX IF EXISTS idx_notes_organization_id;
DROP INDEX IF EXISTS idx_notes_user_id;
DROP INDEX IF EXISTS idx_team_notes_author_id;
DROP INDEX IF EXISTS idx_team_notes_organization_id;
DROP INDEX IF EXISTS idx_todos_client_id;
DROP INDEX IF EXISTS idx_todos_organization_id;
DROP INDEX IF EXISTS idx_organization_members_user_id;
DROP INDEX IF EXISTS idx_organizations_owner_id;

-- ============================================================================
-- DROP UNUSED INDEXES - PRODUCTIVITY & ANALYTICS
-- ============================================================================

DROP INDEX IF EXISTS idx_productivity_sessions_organization_id;
DROP INDEX IF EXISTS idx_productivity_sessions_schedule_event_id;
DROP INDEX IF EXISTS idx_productivity_sessions_time_entry_id;
DROP INDEX IF EXISTS idx_faq_analytics_user_id;
DROP INDEX IF EXISTS idx_walkthrough_analytics_user_id;

-- ============================================================================
-- DROP UNUSED INDEXES - SCHEDULE SYSTEM
-- ============================================================================

DROP INDEX IF EXISTS idx_schedule_events_assigned_to;
DROP INDEX IF EXISTS idx_schedule_events_client_id;
DROP INDEX IF EXISTS idx_schedule_events_converted_from_estimate_id;
DROP INDEX IF EXISTS idx_schedule_events_job_id;
DROP INDEX IF EXISTS idx_schedule_events_job_type_id;
DROP INDEX IF EXISTS idx_schedule_events_organization_id;
DROP INDEX IF EXISTS idx_schedule_events_parent_event_id;
DROP INDEX IF EXISTS idx_schedule_events_service_package_id;
DROP INDEX IF EXISTS idx_schedule_events_user_id;
DROP INDEX IF EXISTS idx_schedule_events_estimate_id;

-- ============================================================================
-- DROP UNUSED INDEXES - USER & WORK ORDERS
-- ============================================================================

DROP INDEX IF EXISTS idx_user_roles_assigned_by;
DROP INDEX IF EXISTS idx_work_orders_schedule_event_id;
DROP INDEX IF EXISTS idx_work_orders_user_id;