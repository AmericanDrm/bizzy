/*
  # Fix Security and Performance Issues

  1. Missing Index
    - Add index on `todos.client_id` foreign key for better query performance
  
  2. Remove Unused Indexes
    - Drop 117 unused indexes that are consuming storage and slowing down writes
    - These indexes were created for optimization but are not being used by queries
  
  3. Fix Function Security
    - Fix `apply_organization_defaults_to_member` functions to use immutable search_path
    - Prevents potential privilege escalation vulnerabilities
  
  Note: Auth DB Connection Strategy must be changed via Supabase Dashboard:
  - Navigate to Database Settings → Connection Pooling
  - Change Auth server connection strategy from fixed to percentage-based
*/

-- ============================================================================
-- 1. Add Missing Foreign Key Index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_todos_client_id 
  ON public.todos(client_id);

-- ============================================================================
-- 2. Drop Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_address_suggestions_cache_organization_id;
DROP INDEX IF EXISTS public.idx_ai_prompt_templates_organization_id;
DROP INDEX IF EXISTS public.idx_break_entries_organization_id;
DROP INDEX IF EXISTS public.idx_break_entries_user_id;
DROP INDEX IF EXISTS public.idx_checklist_template_items_checklist_template_id;
DROP INDEX IF EXISTS public.idx_checklist_template_items_organization_id;
DROP INDEX IF EXISTS public.idx_checklist_templates_created_by;
DROP INDEX IF EXISTS public.idx_checklist_templates_job_type_id;
DROP INDEX IF EXISTS public.idx_client_addresses_client_id;
DROP INDEX IF EXISTS public.idx_client_addresses_organization_id;
DROP INDEX IF EXISTS public.idx_client_addresses_user_id;
DROP INDEX IF EXISTS public.idx_client_job_history_organization_id;
DROP INDEX IF EXISTS public.idx_client_job_history_schedule_event_id;
DROP INDEX IF EXISTS public.idx_client_job_history_service_package_id;
DROP INDEX IF EXISTS public.idx_client_job_history_time_entry_id;
DROP INDEX IF EXISTS public.idx_client_job_history_user_id;
DROP INDEX IF EXISTS public.idx_client_job_quantities_job_type_id;
DROP INDEX IF EXISTS public.idx_client_job_quantities_organization_id;
DROP INDEX IF EXISTS public.idx_client_photos_checklist_item_id;
DROP INDEX IF EXISTS public.idx_client_photos_deleted_by;
DROP INDEX IF EXISTS public.idx_client_photos_organization_id;
DROP INDEX IF EXISTS public.idx_client_photos_productivity_session_id;
DROP INDEX IF EXISTS public.idx_client_photos_user_id;
DROP INDEX IF EXISTS public.idx_client_reminders_client_id;
DROP INDEX IF EXISTS public.idx_client_reminders_created_by;
DROP INDEX IF EXISTS public.idx_client_reminders_job_type_id;
DROP INDEX IF EXISTS public.idx_client_reminders_service_package_id;
DROP INDEX IF EXISTS public.idx_client_unit_quantities_job_type_id;
DROP INDEX IF EXISTS public.idx_client_unit_quantities_organization_id;
DROP INDEX IF EXISTS public.idx_estimate_approval_tokens_estimate_id;
DROP INDEX IF EXISTS public.idx_estimate_items_job_type_id;
DROP INDEX IF EXISTS public.idx_estimate_items_organization_id;
DROP INDEX IF EXISTS public.idx_estimates_client_id;
DROP INDEX IF EXISTS public.idx_estimates_organization_id;
DROP INDEX IF EXISTS public.idx_estimates_user_id;
DROP INDEX IF EXISTS public.idx_expenses_organization_id;
DROP INDEX IF EXISTS public.idx_expenses_parent_expense_id;
DROP INDEX IF EXISTS public.idx_faq_analytics_user_id;
DROP INDEX IF EXISTS public.idx_income_client_id;
DROP INDEX IF EXISTS public.idx_income_job_id;
DROP INDEX IF EXISTS public.idx_income_organization_id;
DROP INDEX IF EXISTS public.idx_income_user_id;
DROP INDEX IF EXISTS public.idx_invoice_items_job_type_id;
DROP INDEX IF EXISTS public.idx_invoice_items_organization_id;
DROP INDEX IF EXISTS public.idx_invoices_client_id;
DROP INDEX IF EXISTS public.idx_invoices_organization_id;
DROP INDEX IF EXISTS public.idx_invoices_user_id;
DROP INDEX IF EXISTS public.idx_job_checklist_items_completed_by;
DROP INDEX IF EXISTS public.idx_job_checklist_items_created_by;
DROP INDEX IF EXISTS public.idx_job_checklist_items_organization_id;
DROP INDEX IF EXISTS public.idx_job_checklists_created_by;
DROP INDEX IF EXISTS public.idx_job_checklists_job_id;
DROP INDEX IF EXISTS public.idx_job_checklists_note_id;
DROP INDEX IF EXISTS public.idx_job_service_packages_organization_id;
DROP INDEX IF EXISTS public.idx_job_supplies_created_by;
DROP INDEX IF EXISTS public.idx_job_supplies_job_id;
DROP INDEX IF EXISTS public.idx_job_supplies_note_id;
DROP INDEX IF EXISTS public.idx_job_type_defaults_job_type_id;
DROP INDEX IF EXISTS public.idx_job_type_defaults_organization_id;
DROP INDEX IF EXISTS public.idx_job_types_organization_id;
DROP INDEX IF EXISTS public.idx_jobs_client_id;
DROP INDEX IF EXISTS public.idx_jobs_estimate_id;
DROP INDEX IF EXISTS public.idx_jobs_organization_id;
DROP INDEX IF EXISTS public.idx_jobs_user_id;
DROP INDEX IF EXISTS public.idx_location_tracking_schedule_event_id;
DROP INDEX IF EXISTS public.idx_message_templates_organization_id;
DROP INDEX IF EXISTS public.idx_mileage_readings_organization_id;
DROP INDEX IF EXISTS public.idx_mileage_readings_user_id;
DROP INDEX IF EXISTS public.idx_mileage_trips_organization_id;
DROP INDEX IF EXISTS public.idx_mileage_trips_time_entry_id;
DROP INDEX IF EXISTS public.idx_mileage_trips_user_id;
DROP INDEX IF EXISTS public.idx_mileage_trips_vehicle_id;
DROP INDEX IF EXISTS public.idx_notes_client_id;
DROP INDEX IF EXISTS public.idx_notes_organization_id;
DROP INDEX IF EXISTS public.idx_notes_user_id;
DROP INDEX IF EXISTS public.idx_organization_members_user_id;
DROP INDEX IF EXISTS public.idx_organizations_owner_id;
DROP INDEX IF EXISTS public.idx_productivity_sessions_organization_id;
DROP INDEX IF EXISTS public.idx_productivity_sessions_schedule_event_id;
DROP INDEX IF EXISTS public.idx_productivity_sessions_time_entry_id;
DROP INDEX IF EXISTS public.idx_push_notifications_organization_id;
DROP INDEX IF EXISTS public.idx_push_notifications_user_id;
DROP INDEX IF EXISTS public.idx_push_tokens_organization_id;
DROP INDEX IF EXISTS public.idx_schedule_event_team_members_member_id;
DROP INDEX IF EXISTS public.idx_schedule_event_team_members_organization_id;
DROP INDEX IF EXISTS public.idx_schedule_events_assigned_to;
DROP INDEX IF EXISTS public.idx_schedule_events_client_id;
DROP INDEX IF EXISTS public.idx_schedule_events_converted_from_estimate_id;
DROP INDEX IF EXISTS public.idx_schedule_events_estimate_id;
DROP INDEX IF EXISTS public.idx_schedule_events_job_id;
DROP INDEX IF EXISTS public.idx_schedule_events_job_type_id;
DROP INDEX IF EXISTS public.idx_schedule_events_organization_id;
DROP INDEX IF EXISTS public.idx_schedule_events_parent_event_id;
DROP INDEX IF EXISTS public.idx_schedule_events_service_package_id;
DROP INDEX IF EXISTS public.idx_schedule_events_user_id;
DROP INDEX IF EXISTS public.idx_sent_messages_client_id;
DROP INDEX IF EXISTS public.idx_sent_messages_job_id;
DROP INDEX IF EXISTS public.idx_sent_messages_organization_id;
DROP INDEX IF EXISTS public.idx_sent_messages_reminder_id;
DROP INDEX IF EXISTS public.idx_sent_messages_schedule_event_id;
DROP INDEX IF EXISTS public.idx_sent_messages_user_id;
DROP INDEX IF EXISTS public.idx_sms_messages_client_id;
DROP INDEX IF EXISTS public.idx_sms_messages_organization_id;
DROP INDEX IF EXISTS public.idx_supply_template_items_organization_id;
DROP INDEX IF EXISTS public.idx_supply_template_items_template_id;
DROP INDEX IF EXISTS public.idx_supply_templates_created_by;
DROP INDEX IF EXISTS public.idx_supply_templates_organization_id;
DROP INDEX IF EXISTS public.idx_team_member_production_rates_organization_id;
DROP INDEX IF EXISTS public.idx_team_notes_author_id;
DROP INDEX IF EXISTS public.idx_team_notes_organization_id;
DROP INDEX IF EXISTS public.idx_time_entries_vehicle_id;
DROP INDEX IF EXISTS public.idx_todos_organization_id;
DROP INDEX IF EXISTS public.idx_user_roles_assigned_by;
DROP INDEX IF EXISTS public.idx_vehicles_organization_id;
DROP INDEX IF EXISTS public.idx_walkthrough_analytics_user_id;
DROP INDEX IF EXISTS public.idx_work_orders_schedule_event_id;
DROP INDEX IF EXISTS public.idx_work_orders_user_id;

-- ============================================================================
-- 3. Fix Function Search Path Security Issue
-- ============================================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS apply_defaults_on_member_join ON public.organization_members;

-- Drop both versions of the function
DROP FUNCTION IF EXISTS public.apply_organization_defaults_to_member();
DROP FUNCTION IF EXISTS public.apply_organization_defaults_to_member(uuid, uuid);

-- Recreate the trigger function with immutable search_path
CREATE OR REPLACE FUNCTION public.apply_organization_defaults_to_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_defaults RECORD;
BEGIN
  -- Get organization defaults
  SELECT * INTO org_defaults
  FROM organization_defaults
  WHERE organization_id = NEW.organization_id;

  -- If defaults exist, create layout preferences for the new member
  IF FOUND THEN
    INSERT INTO layout_preferences (
      user_id,
      home_cards,
      tabs,
      quick_actions,
      notes_tabs,
      created_at,
      updated_at
    )
    VALUES (
      NEW.user_id,
      org_defaults.default_home_cards,
      org_defaults.default_tabs,
      org_defaults.default_quick_actions,
      org_defaults.default_notes_tabs,
      now(),
      now()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the regular function with immutable search_path
CREATE OR REPLACE FUNCTION public.apply_organization_defaults_to_member(
  member_user_id uuid,
  org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_defaults record;
BEGIN
  -- Get organization defaults
  SELECT * INTO v_defaults
  FROM organization_defaults
  WHERE organization_id = org_id;

  -- If no defaults exist, nothing to do
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Apply layout preferences if they don't exist for the user
  INSERT INTO layout_preferences (
    user_id,
    organization_id,
    stats_cards,
    quick_actions,
    notes_tabs,
    created_at,
    updated_at
  )
  SELECT
    member_user_id,
    org_id,
    v_defaults.default_stats_cards,
    v_defaults.default_quick_actions,
    v_defaults.default_notes_tabs,
    now(),
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM layout_preferences
    WHERE user_id = member_user_id
    AND organization_id = org_id
  );

  -- Apply AI prompt templates if they don't exist for the user
  INSERT INTO ai_prompt_templates (
    user_id,
    organization_id,
    category,
    prompt,
    is_default,
    created_at
  )
  SELECT
    member_user_id,
    org_id,
    t.category,
    t.prompt,
    t.is_default,
    now()
  FROM unnest(
    v_defaults.default_ai_prompts
  ) AS t(category text, prompt text, is_default boolean)
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_prompt_templates
    WHERE user_id = member_user_id
    AND organization_id = org_id
  );

END;
$$;

-- Recreate the trigger
CREATE TRIGGER apply_defaults_on_member_join
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_organization_defaults_to_member();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.apply_organization_defaults_to_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_organization_defaults_to_member(uuid, uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.apply_organization_defaults_to_member() IS 'Trigger function to apply organization defaults to new members. Uses immutable search_path to prevent privilege escalation.';
COMMENT ON FUNCTION public.apply_organization_defaults_to_member(uuid, uuid) IS 'Applies organization defaults to a member. Uses immutable search_path to prevent privilege escalation.';
