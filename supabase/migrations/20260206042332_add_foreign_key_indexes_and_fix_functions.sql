/*
  # Add Foreign Key Indexes and Fix Function Search Paths

  1. New Indexes
    - `idx_client_job_history_schedule_event_id` on client_job_history(schedule_event_id)
    - `idx_client_job_history_service_package_id` on client_job_history(service_package_id)
    - `idx_client_job_history_time_entry_id` on client_job_history(time_entry_id)
    - `idx_client_photos_productivity_session_id` on client_photos(productivity_session_id)
    - `idx_detected_locations_time_entry_id` on detected_locations(time_entry_id)
    - `idx_estimate_items_job_type_id` on estimate_items(job_type_id)
    - `idx_income_client_id` on income(client_id)
    - `idx_income_job_id` on income(job_id)
    - `idx_invoice_items_job_type_id` on invoice_items(job_type_id)
    - `idx_notes_user_id` on notes(user_id)
    - `idx_organizations_owner_id` on organizations(owner_id)
    - `idx_productivity_session_breaks_session_id` on productivity_session_breaks(productivity_session_id)
    - `idx_schedule_events_client_id` on schedule_events(client_id)
    - `idx_schedule_events_converted_from_estimate_id` on schedule_events(converted_from_estimate_id)
    - `idx_schedule_events_job_id` on schedule_events(job_id)
    - `idx_schedule_events_job_type_id` on schedule_events(job_type_id)
    - `idx_schedule_events_service_package_id` on schedule_events(service_package_id)
    - `idx_todos_user_id` on todos(user_id)
    - `idx_user_roles_assigned_by` on user_roles(assigned_by)
    - `idx_work_orders_client_id` on work_orders(client_id)

  2. Security
    - Enable RLS on productivity_session_breaks table
    - Add SELECT, INSERT, UPDATE, DELETE policies for authenticated users
    - Fix mutable search_path on 19 public functions

  3. Important Notes
    - All indexes use IF NOT EXISTS for safe re-application
    - Function search paths are set to '' (empty) to prevent search_path injection
*/

-- 1. Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_client_job_history_schedule_event_id ON public.client_job_history(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_service_package_id ON public.client_job_history(service_package_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_time_entry_id ON public.client_job_history(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_productivity_session_id ON public.client_photos(productivity_session_id);
CREATE INDEX IF NOT EXISTS idx_detected_locations_time_entry_id ON public.detected_locations(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_job_type_id ON public.estimate_items(job_type_id);
CREATE INDEX IF NOT EXISTS idx_income_client_id ON public.income(client_id);
CREATE INDEX IF NOT EXISTS idx_income_job_id ON public.income(job_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_job_type_id ON public.invoice_items(job_type_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_productivity_session_breaks_session_id ON public.productivity_session_breaks(productivity_session_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_client_id_fk ON public.schedule_events(client_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_converted_estimate ON public.schedule_events(converted_from_estimate_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job_id_fk ON public.schedule_events(job_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job_type_id_fk ON public.schedule_events(job_type_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_service_package_id ON public.schedule_events(service_package_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON public.user_roles(assigned_by);
CREATE INDEX IF NOT EXISTS idx_work_orders_client_id ON public.work_orders(client_id);

-- 2. Enable RLS on productivity_session_breaks and add policies
ALTER TABLE public.productivity_session_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session breaks"
  ON public.productivity_session_breaks
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own session breaks"
  ON public.productivity_session_breaks
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own session breaks"
  ON public.productivity_session_breaks
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own session breaks"
  ON public.productivity_session_breaks
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- 3. Fix mutable search_path on all flagged functions
ALTER FUNCTION public.update_notes_updated_at() SET search_path = '';
ALTER FUNCTION public.calculate_session_duration() SET search_path = '';
ALTER FUNCTION public.generate_invoice_number() SET search_path = '';
ALTER FUNCTION public.generate_estimate_number() SET search_path = '';
ALTER FUNCTION public.is_admin(uuid) SET search_path = '';
ALTER FUNCTION public.is_manager(uuid) SET search_path = '';
ALTER FUNCTION public.update_detected_locations_updated_at() SET search_path = '';
ALTER FUNCTION public.get_next_invoice_number(uuid) SET search_path = '';
ALTER FUNCTION public.get_next_estimate_number(uuid) SET search_path = '';
ALTER FUNCTION public.generate_org_join_code() SET search_path = '';
ALTER FUNCTION public.set_org_join_code() SET search_path = '';
ALTER FUNCTION public.update_client_profile_from_history() SET search_path = '';
ALTER FUNCTION public.set_default_organization_id() SET search_path = '';
ALTER FUNCTION public.update_client_profile_from_job() SET search_path = '';
ALTER FUNCTION public.initialize_default_crew_efficiency_rules(uuid) SET search_path = '';
ALTER FUNCTION public.is_admin_or_manager(uuid) SET search_path = '';
ALTER FUNCTION public.update_user_roles_updated_at() SET search_path = '';
ALTER FUNCTION public.handle_new_user_v2() SET search_path = '';
ALTER FUNCTION public.get_user_role(uuid) SET search_path = '';
