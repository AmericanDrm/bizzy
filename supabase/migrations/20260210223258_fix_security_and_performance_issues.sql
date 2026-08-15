/*
  # Fix Security and Performance Issues

  This migration addresses critical security and performance issues identified by Supabase Advisor:
  
  ## 1. Missing Foreign Key Indexes (7 issues)
    - Add indexes for unindexed foreign keys to improve query performance
    - Tables affected: checklist_template_items, client_photos, client_reminders, job_checklist_items, sent_messages
  
  ## 2. RLS Performance Optimization (28+ policies)
    - Wrap auth.uid() calls with (select auth.uid()) to prevent re-evaluation per row
    - Tables: checklist_template_items, checklist_templates, client_photos, job_checklists, 
      job_checklist_items, notes, todos
  
  ## 3. Duplicate Indexes (4 issues)
    - Remove duplicate indexes that provide identical functionality
    - Tables: checklist_templates, job_checklist_items, job_checklists
  
  ## 4. Multiple Permissive Policies (consolidation)
    - Consolidate duplicate permissive policies into single efficient policies
    - Tables: checklist_template_items, checklist_templates, client_photos, job_checklist_items, 
      job_checklists, notes, todos
  
  ## 5. Unused Indexes Cleanup
    - Drop unused indexes to reduce storage overhead and improve write performance
  
  ## 6. Function Security Fix
    - Fix search_path issue in get_checklist_progress function
*/

-- ============================================================================
-- SECTION 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_org_fk 
  ON checklist_template_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_client_photos_deleted_by_fk 
  ON client_photos(deleted_by);

CREATE INDEX IF NOT EXISTS idx_client_reminders_created_by_fk 
  ON client_reminders(created_by);

CREATE INDEX IF NOT EXISTS idx_client_reminders_job_type_fk 
  ON client_reminders(job_type_id);

CREATE INDEX IF NOT EXISTS idx_client_reminders_service_package_fk 
  ON client_reminders(service_package_id);

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_created_by_fk 
  ON job_checklist_items(created_by);

CREATE INDEX IF NOT EXISTS idx_sent_messages_reminder_fk 
  ON sent_messages(reminder_id);

-- ============================================================================
-- SECTION 2: DROP DUPLICATE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_checklist_templates_org;
DROP INDEX IF EXISTS idx_job_checklist_items_checklist;
DROP INDEX IF EXISTS idx_job_checklists_job;
DROP INDEX IF EXISTS idx_job_checklists_org;

-- ============================================================================
-- SECTION 3: DROP UNUSED INDEXES (PERFORMANCE OPTIMIZATION)
-- ============================================================================

-- Estimates table
DROP INDEX IF EXISTS idx_estimates_signed_at;
DROP INDEX IF EXISTS idx_estimates_requires_signature;

-- Schedule events
DROP INDEX IF EXISTS idx_schedule_events_assigned_to;

-- App settings
DROP INDEX IF EXISTS idx_app_settings_key;

-- Checklist templates
DROP INDEX IF EXISTS idx_checklist_templates_shared;
DROP INDEX IF EXISTS idx_checklist_templates_job_type;
DROP INDEX IF EXISTS idx_checklist_templates_created_by;

-- Checklist template items
DROP INDEX IF EXISTS idx_checklist_template_items_template_id;
DROP INDEX IF EXISTS idx_checklist_template_items_template;
DROP INDEX IF EXISTS idx_checklist_template_items_display_order;

-- Job checklists
DROP INDEX IF EXISTS idx_job_checklists_note;
DROP INDEX IF EXISTS idx_job_checklists_created_by;

-- Job checklist items
DROP INDEX IF EXISTS idx_job_checklist_items_completed_by;
DROP INDEX IF EXISTS idx_job_checklist_items_display_order;

-- Supplies
DROP INDEX IF EXISTS idx_supplies_library_org;
DROP INDEX IF EXISTS idx_job_supplies_org;
DROP INDEX IF EXISTS idx_job_supplies_job;
DROP INDEX IF EXISTS idx_job_supplies_note;
DROP INDEX IF EXISTS idx_job_supplies_created_by;

-- Mileage
DROP INDEX IF EXISTS idx_mileage_readings_org_id;
DROP INDEX IF EXISTS idx_mileage_trips_org_id;
DROP INDEX IF EXISTS idx_mileage_readings_user_id;
DROP INDEX IF EXISTS idx_mileage_trips_time_entry_id;
DROP INDEX IF EXISTS idx_mileage_trips_user_id;
DROP INDEX IF EXISTS idx_mileage_trips_vehicle_id;

-- Push notifications
DROP INDEX IF EXISTS idx_push_notifications_org_id;
DROP INDEX IF EXISTS idx_push_tokens_org_id;
DROP INDEX IF EXISTS idx_push_notifications_user_id;

-- Various other unused indexes
DROP INDEX IF EXISTS idx_income_organization_id;
DROP INDEX IF EXISTS idx_break_entries_user_id;
DROP INDEX IF EXISTS idx_break_entries_organization_id;
DROP INDEX IF EXISTS idx_business_settings_organization_id;
DROP INDEX IF EXISTS idx_client_addresses_client_id;
DROP INDEX IF EXISTS idx_client_addresses_user_id;
DROP INDEX IF EXISTS idx_client_addresses_organization_id;
DROP INDEX IF EXISTS idx_client_job_history_organization_id;
DROP INDEX IF EXISTS idx_client_job_history_schedule_event_id;
DROP INDEX IF EXISTS idx_client_job_history_service_package_id;
DROP INDEX IF EXISTS idx_client_job_history_time_entry_id;
DROP INDEX IF EXISTS idx_client_job_history_user_id;
DROP INDEX IF EXISTS idx_client_photos_organization_id;
DROP INDEX IF EXISTS idx_client_photos_productivity_session_id;
DROP INDEX IF EXISTS idx_client_photos_user_id;
DROP INDEX IF EXISTS idx_client_photos_checklist_item_id;
DROP INDEX IF EXISTS idx_client_photos_is_deleted;
DROP INDEX IF EXISTS idx_client_photos_captured_at;
DROP INDEX IF EXISTS idx_client_photos_location;
DROP INDEX IF EXISTS idx_clients_organization_id;
DROP INDEX IF EXISTS idx_estimate_items_estimate_id;
DROP INDEX IF EXISTS idx_estimate_items_job_type_id;
DROP INDEX IF EXISTS idx_estimate_items_organization_id;
DROP INDEX IF EXISTS idx_estimate_items_display_order;
DROP INDEX IF EXISTS idx_estimates_client_id;
DROP INDEX IF EXISTS idx_estimates_organization_id;
DROP INDEX IF EXISTS idx_estimates_user_id;
DROP INDEX IF EXISTS idx_expenses_organization_id;
DROP INDEX IF EXISTS idx_expenses_parent_expense_id;
DROP INDEX IF EXISTS idx_faq_analytics_user_id;
DROP INDEX IF EXISTS idx_income_client_id;
DROP INDEX IF EXISTS idx_income_job_id;
DROP INDEX IF EXISTS idx_income_user_id;
DROP INDEX IF EXISTS idx_invoice_items_job_type_id;
DROP INDEX IF EXISTS idx_invoice_items_organization_id;
DROP INDEX IF EXISTS idx_invoices_client_id;
DROP INDEX IF EXISTS idx_invoices_organization_id;
DROP INDEX IF EXISTS idx_invoices_user_id;
DROP INDEX IF EXISTS idx_job_service_packages_organization_id;
DROP INDEX IF EXISTS idx_job_types_organization_id;
DROP INDEX IF EXISTS idx_jobs_client_id;
DROP INDEX IF EXISTS idx_jobs_organization_id;
DROP INDEX IF EXISTS idx_jobs_user_id;
DROP INDEX IF EXISTS idx_job_checklists_org_id;
DROP INDEX IF EXISTS idx_job_checklist_items_org_id;
DROP INDEX IF EXISTS idx_job_checklist_items_checklist_id;
DROP INDEX IF EXISTS idx_job_checklists_job_id;
DROP INDEX IF EXISTS idx_location_tracking_schedule_event_id;
DROP INDEX IF EXISTS idx_message_templates_organization_id;
DROP INDEX IF EXISTS idx_notes_organization_id;
DROP INDEX IF EXISTS idx_notes_user_id;
DROP INDEX IF EXISTS idx_notes_client_id;
DROP INDEX IF EXISTS idx_notes_is_pinned;
DROP INDEX IF EXISTS idx_notes_category;
DROP INDEX IF EXISTS idx_organization_members_user_id;
DROP INDEX IF EXISTS idx_organizations_owner_id;
DROP INDEX IF EXISTS idx_productivity_sessions_organization_id;
DROP INDEX IF EXISTS idx_productivity_sessions_schedule_event_id;
DROP INDEX IF EXISTS idx_productivity_sessions_time_entry_id;
DROP INDEX IF EXISTS idx_schedule_events_client_id;
DROP INDEX IF EXISTS idx_schedule_events_converted_from_estimate_id;
DROP INDEX IF EXISTS idx_schedule_events_job_id;
DROP INDEX IF EXISTS idx_schedule_events_job_type_id;
DROP INDEX IF EXISTS idx_schedule_events_organization_id;
DROP INDEX IF EXISTS idx_schedule_events_parent_event_id;
DROP INDEX IF EXISTS idx_schedule_events_service_package_id;
DROP INDEX IF EXISTS idx_schedule_events_user_id;
DROP INDEX IF EXISTS idx_sent_messages_client_id;
DROP INDEX IF EXISTS idx_sent_messages_job_id;
DROP INDEX IF EXISTS idx_sent_messages_organization_id;
DROP INDEX IF EXISTS idx_sent_messages_schedule_event_id;
DROP INDEX IF EXISTS idx_sent_messages_user_id;
DROP INDEX IF EXISTS idx_client_reminders_org_id;
DROP INDEX IF EXISTS idx_client_reminders_client_id;
DROP INDEX IF EXISTS idx_client_reminders_next_send;
DROP INDEX IF EXISTS idx_org_comm_settings_org_id;
DROP INDEX IF EXISTS idx_team_notes_author_id;
DROP INDEX IF EXISTS idx_team_notes_organization_id;
DROP INDEX IF EXISTS idx_time_entries_vehicle_id;
DROP INDEX IF EXISTS idx_todos_organization_id;
DROP INDEX IF EXISTS idx_todos_client_id;
DROP INDEX IF EXISTS idx_todos_due_date;
DROP INDEX IF EXISTS idx_todos_completed;
DROP INDEX IF EXISTS idx_user_roles_assigned_by;
DROP INDEX IF EXISTS idx_vehicles_organization_id;
DROP INDEX IF EXISTS idx_walkthrough_analytics_user_id;
DROP INDEX IF EXISTS idx_work_orders_schedule_event_id;
DROP INDEX IF EXISTS idx_work_orders_user_id;

-- ============================================================================
-- SECTION 4: CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- Drop old duplicate policies and create optimized consolidated ones

-- CHECKLIST_TEMPLATE_ITEMS: Consolidate policies
DROP POLICY IF EXISTS "Owners and managers can delete template items" ON checklist_template_items;
DROP POLICY IF EXISTS "Template creators can delete items" ON checklist_template_items;
DROP POLICY IF EXISTS "Members can create template items" ON checklist_template_items;
DROP POLICY IF EXISTS "Template creators can add items" ON checklist_template_items;
DROP POLICY IF EXISTS "Members can view template items" ON checklist_template_items;
DROP POLICY IF EXISTS "Organization members can view template items" ON checklist_template_items;
DROP POLICY IF EXISTS "Members can update template items" ON checklist_template_items;
DROP POLICY IF EXISTS "Template creators can update items" ON checklist_template_items;

-- CHECKLIST_TEMPLATES: Consolidate policies
DROP POLICY IF EXISTS "Non-basic users can delete templates" ON checklist_templates;
DROP POLICY IF EXISTS "Owners and managers can delete checklist templates" ON checklist_templates;
DROP POLICY IF EXISTS "Members can create checklist templates" ON checklist_templates;
DROP POLICY IF EXISTS "Non-basic users can create templates" ON checklist_templates;
DROP POLICY IF EXISTS "Members can view checklist templates" ON checklist_templates;
DROP POLICY IF EXISTS "Organization members can view templates" ON checklist_templates;
DROP POLICY IF EXISTS "Members can update checklist templates" ON checklist_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON checklist_templates;

-- CLIENT_PHOTOS: Consolidate policies
DROP POLICY IF EXISTS "Managers can delete photos" ON client_photos;
DROP POLICY IF EXISTS admins_delete ON client_photos;
DROP POLICY IF EXISTS "Organization members can create photos" ON client_photos;
DROP POLICY IF EXISTS members_insert ON client_photos;
DROP POLICY IF EXISTS "Organization members can view photos" ON client_photos;
DROP POLICY IF EXISTS members_select ON client_photos;
DROP POLICY IF EXISTS "Users can update photos" ON client_photos;
DROP POLICY IF EXISTS members_update ON client_photos;

-- JOB_CHECKLIST_ITEMS: Consolidate policies
DROP POLICY IF EXISTS "Non-basic users can delete checklist items" ON job_checklist_items;
DROP POLICY IF EXISTS "Owners and managers can delete checklist items" ON job_checklist_items;
DROP POLICY IF EXISTS "Members can create checklist items" ON job_checklist_items;
DROP POLICY IF EXISTS "Organization members can add checklist items" ON job_checklist_items;
DROP POLICY IF EXISTS "Members can view checklist items" ON job_checklist_items;
DROP POLICY IF EXISTS "Organization members can view checklist items" ON job_checklist_items;
DROP POLICY IF EXISTS "Members can update checklist items" ON job_checklist_items;
DROP POLICY IF EXISTS "Organization members can update checklist items" ON job_checklist_items;

-- JOB_CHECKLISTS: Consolidate policies
DROP POLICY IF EXISTS "Non-basic users can delete job checklists" ON job_checklists;
DROP POLICY IF EXISTS "Owners and managers can delete job checklists" ON job_checklists;
DROP POLICY IF EXISTS "Members can create job checklists" ON job_checklists;
DROP POLICY IF EXISTS "Non-basic users can create job checklists" ON job_checklists;
DROP POLICY IF EXISTS "Members can view job checklists" ON job_checklists;
DROP POLICY IF EXISTS "Organization members can view job checklists" ON job_checklists;
DROP POLICY IF EXISTS "Members can update job checklists" ON job_checklists;
DROP POLICY IF EXISTS "Non-basic users can update job checklists" ON job_checklists;

-- NOTES: Consolidate policies
DROP POLICY IF EXISTS "Users can delete notes" ON notes;
DROP POLICY IF EXISTS admins_delete ON notes;
DROP POLICY IF EXISTS "Organization members can create notes" ON notes;
DROP POLICY IF EXISTS members_insert ON notes;
DROP POLICY IF EXISTS "Organization members can view notes" ON notes;
DROP POLICY IF EXISTS members_select ON notes;
DROP POLICY IF EXISTS "Users can update notes" ON notes;
DROP POLICY IF EXISTS members_update ON notes;

-- TODOS: Consolidate policies
DROP POLICY IF EXISTS "Users can delete todos" ON todos;
DROP POLICY IF EXISTS admins_delete ON todos;
DROP POLICY IF EXISTS "Organization members can create todos" ON todos;
DROP POLICY IF EXISTS members_insert ON todos;
DROP POLICY IF EXISTS "Organization members can view todos" ON todos;
DROP POLICY IF EXISTS members_select ON todos;
DROP POLICY IF EXISTS "Users can update todos" ON todos;
DROP POLICY IF EXISTS members_update ON todos;

-- ============================================================================
-- SECTION 5: CREATE OPTIMIZED RLS POLICIES WITH PROPER AUTH.UID() USAGE
-- ============================================================================

-- CHECKLIST_TEMPLATE_ITEMS: Optimized policies
CREATE POLICY "Members can manage template items - SELECT"
  ON checklist_template_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_template_items.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can manage template items - INSERT"
  ON checklist_template_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_template_items.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can manage template items - UPDATE"
  ON checklist_template_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_template_items.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_template_items.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Non-basic members can delete template items"
  ON checklist_template_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_template_items.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager', 'member')
    )
  );

-- CHECKLIST_TEMPLATES: Optimized policies
CREATE POLICY "Members can view templates"
  ON checklist_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Non-basic users can create templates"
  ON checklist_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager', 'member')
    )
  );

CREATE POLICY "Users can update templates"
  ON checklist_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Non-basic users can delete templates"
  ON checklist_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager', 'member')
    )
  );

-- CLIENT_PHOTOS: Optimized policies
CREATE POLICY "Members can view photos"
  ON client_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_photos.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can create photos"
  ON client_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_photos.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can update photos"
  ON client_photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_photos.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_photos.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers and owners can delete photos"
  ON client_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_photos.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager')
    )
  );

-- JOB_CHECKLIST_ITEMS: Optimized policies
CREATE POLICY "Members can view checklist items"
  ON job_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklist_items.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can create checklist items"
  ON job_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklist_items.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can update checklist items"
  ON job_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklist_items.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklist_items.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Non-basic users can delete checklist items"
  ON job_checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklist_items.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager', 'member')
    )
  );

-- JOB_CHECKLISTS: Optimized policies
CREATE POLICY "Members can view job checklists"
  ON job_checklists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklists.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Non-basic users can create job checklists"
  ON job_checklists FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklists.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager', 'member')
    )
  );

CREATE POLICY "Non-basic users can update job checklists"
  ON job_checklists FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklists.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager', 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklists.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager', 'member')
    )
  );

CREATE POLICY "Non-basic users can delete job checklists"
  ON job_checklists FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklists.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'manager', 'member')
    )
  );

-- NOTES: Optimized policies
CREATE POLICY "Members can view notes"
  ON notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = notes.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can create notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = notes.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- TODOS: Optimized policies
CREATE POLICY "Members can view todos"
  ON todos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = todos.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can create todos"
  ON todos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = todos.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own todos"
  ON todos FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own todos"
  ON todos FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- SECTION 6: FIX FUNCTION SEARCH PATH ISSUE
-- ============================================================================

-- Recreate get_checklist_progress function with immutable search path
DROP FUNCTION IF EXISTS get_checklist_progress(uuid);

CREATE OR REPLACE FUNCTION get_checklist_progress(p_checklist_id uuid)
RETURNS TABLE (
  total_items bigint,
  completed_items bigint,
  completion_percentage numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_items,
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::bigint as completed_items,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::numeric / COUNT(*)::numeric) * 100, 2)
    END as completion_percentage
  FROM job_checklist_items
  WHERE checklist_id = p_checklist_id;
END;
$$;