/*
  # Fix Security and Performance Issues
  
  1. Indexes
    - Add missing indexes for foreign keys on mileage_readings and mileage_trips
    - Drop unused indexes that are not being utilized
  
  2. RLS Policy Optimization
    - Optimize auth.uid() calls in RLS policies using (select auth.uid()) pattern
    - Affected tables: team_notes, vehicles, mileage_readings, mileage_trips
  
  3. Multiple Permissive Policies
    - Consolidate multiple SELECT policies on crew_live_locations into a single policy
  
  4. Function Security
    - Fix search_path for functions to prevent role mutable issues
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- Add index for mileage_readings.organization_id
CREATE INDEX IF NOT EXISTS idx_mileage_readings_org_id 
ON mileage_readings(organization_id);

-- Add index for mileage_trips.organization_id
CREATE INDEX IF NOT EXISTS idx_mileage_trips_org_id 
ON mileage_trips(organization_id);

-- =====================================================
-- 2. OPTIMIZE RLS POLICIES - TEAM NOTES
-- =====================================================

DROP POLICY IF EXISTS "Admins and owners can insert team notes" ON team_notes;

CREATE POLICY "Admins and owners can insert team notes"
  ON team_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = team_notes.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('admin', 'owner')
    )
  );

-- =====================================================
-- 3. OPTIMIZE RLS POLICIES - VEHICLES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can insert own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can update own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can delete own vehicles" ON vehicles;

CREATE POLICY "Users can view own vehicles"
  ON vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = vehicles.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own vehicles"
  ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = vehicles.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own vehicles"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = vehicles.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = vehicles.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own vehicles"
  ON vehicles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = vehicles.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 4. OPTIMIZE RLS POLICIES - MILEAGE READINGS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own mileage readings" ON mileage_readings;
DROP POLICY IF EXISTS "Users can insert own mileage readings" ON mileage_readings;
DROP POLICY IF EXISTS "Users can update own mileage readings" ON mileage_readings;
DROP POLICY IF EXISTS "Users can delete own mileage readings" ON mileage_readings;

CREATE POLICY "Users can view own mileage readings"
  ON mileage_readings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_readings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own mileage readings"
  ON mileage_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_readings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own mileage readings"
  ON mileage_readings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_readings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_readings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own mileage readings"
  ON mileage_readings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_readings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 5. OPTIMIZE RLS POLICIES - MILEAGE TRIPS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own mileage trips" ON mileage_trips;
DROP POLICY IF EXISTS "Users can insert own mileage trips" ON mileage_trips;
DROP POLICY IF EXISTS "Users can update own mileage trips" ON mileage_trips;
DROP POLICY IF EXISTS "Users can delete own mileage trips" ON mileage_trips;

CREATE POLICY "Users can view own mileage trips"
  ON mileage_trips
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_trips.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own mileage trips"
  ON mileage_trips
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_trips.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own mileage trips"
  ON mileage_trips
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_trips.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_trips.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own mileage trips"
  ON mileage_trips
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = mileage_trips.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 6. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES - CREW LIVE LOCATIONS
-- =====================================================

DROP POLICY IF EXISTS "Admins can view org live locations" ON crew_live_locations;
DROP POLICY IF EXISTS "Users can view own live location" ON crew_live_locations;

CREATE POLICY "Users can view live locations in their org"
  ON crew_live_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = crew_live_locations.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 7. DROP UNUSED INDEXES
-- =====================================================

-- Drop all unused indexes identified by Supabase
DROP INDEX IF EXISTS idx_expenses_receipt_id;
DROP INDEX IF EXISTS idx_location_tracking_user_timestamp;
DROP INDEX IF EXISTS idx_location_tracking_schedule_event;
DROP INDEX IF EXISTS idx_productivity_sessions_schedule_event;
DROP INDEX IF EXISTS idx_crew_efficiency_service_type;
DROP INDEX IF EXISTS idx_schedule_events_crew_size;
DROP INDEX IF EXISTS idx_jobs_client_completed;
DROP INDEX IF EXISTS idx_time_entries_is_clocked_in;
DROP INDEX IF EXISTS idx_client_photos_location;
DROP INDEX IF EXISTS idx_productivity_sessions_time_entry;
DROP INDEX IF EXISTS idx_work_orders_user_id;
DROP INDEX IF EXISTS idx_work_orders_org_id;
DROP INDEX IF EXISTS idx_work_orders_schedule_event_id;
DROP INDEX IF EXISTS idx_work_orders_status;
DROP INDEX IF EXISTS idx_faq_analytics_user_id;
DROP INDEX IF EXISTS idx_faq_analytics_created_at;
DROP INDEX IF EXISTS idx_faq_analytics_action_type;
DROP INDEX IF EXISTS idx_walkthrough_analytics_user_id;
DROP INDEX IF EXISTS idx_walkthrough_analytics_session_id;
DROP INDEX IF EXISTS idx_walkthrough_analytics_created_at;
DROP INDEX IF EXISTS idx_walkthrough_analytics_action_type;
DROP INDEX IF EXISTS idx_jobs_duration_tracking;
DROP INDEX IF EXISTS idx_jobs_user_id;
DROP INDEX IF EXISTS idx_jobs_client_id;
DROP INDEX IF EXISTS idx_schedule_events_user_id;
DROP INDEX IF EXISTS idx_schedule_events_start_time;
DROP INDEX IF EXISTS idx_income_user_id;
DROP INDEX IF EXISTS idx_income_date;
DROP INDEX IF EXISTS idx_expenses_date;
DROP INDEX IF EXISTS idx_push_tokens_user_id;
DROP INDEX IF EXISTS idx_push_tokens_active;
DROP INDEX IF EXISTS idx_push_notifications_user_id;
DROP INDEX IF EXISTS idx_push_notifications_type;
DROP INDEX IF EXISTS idx_message_templates_type;
DROP INDEX IF EXISTS idx_sent_messages_user_id;
DROP INDEX IF EXISTS idx_sent_messages_client_id;
DROP INDEX IF EXISTS idx_sent_messages_event_id;
DROP INDEX IF EXISTS idx_sent_messages_job_id;
DROP INDEX IF EXISTS idx_sent_messages_sent_at;
DROP INDEX IF EXISTS idx_push_notifications_read;
DROP INDEX IF EXISTS idx_client_photos_user_id;
DROP INDEX IF EXISTS time_entries_clock_out_idx;
DROP INDEX IF EXISTS idx_client_job_history_user_id;
DROP INDEX IF EXISTS idx_client_job_history_visit_type;
DROP INDEX IF EXISTS idx_client_job_history_completed_at;
DROP INDEX IF EXISTS break_entries_user_id_idx;
DROP INDEX IF EXISTS idx_crew_live_locations_org;
DROP INDEX IF EXISTS idx_team_notes_org_id;
DROP INDEX IF EXISTS idx_team_notes_author_id;
DROP INDEX IF EXISTS idx_team_notes_created_at;
DROP INDEX IF EXISTS idx_invoices_user_id;
DROP INDEX IF EXISTS idx_invoices_client_id;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_estimates_user_id;
DROP INDEX IF EXISTS idx_estimates_client_id;
DROP INDEX IF EXISTS idx_estimates_status;
DROP INDEX IF EXISTS idx_estimate_items_estimate_id;
DROP INDEX IF EXISTS idx_job_types_is_active;
DROP INDEX IF EXISTS idx_expenses_parent;
DROP INDEX IF EXISTS idx_expenses_recurring;
DROP INDEX IF EXISTS idx_schedule_events_is_recurring;
DROP INDEX IF EXISTS idx_schedule_events_parent_id;
DROP INDEX IF EXISTS idx_schedule_events_scope_confirmed;
DROP INDEX IF EXISTS idx_client_photos_time_entry;
DROP INDEX IF EXISTS idx_clock_out_prompts_triggered_at;
DROP INDEX IF EXISTS idx_detected_locations_dismissed;
DROP INDEX IF EXISTS idx_detected_locations_coords;
DROP INDEX IF EXISTS idx_detected_locations_last_detected;
DROP INDEX IF EXISTS idx_client_addresses_client_id;
DROP INDEX IF EXISTS idx_client_addresses_user_id;
DROP INDEX IF EXISTS idx_clients_organization_id;
DROP INDEX IF EXISTS idx_jobs_organization_id;
DROP INDEX IF EXISTS idx_job_types_organization_id;
DROP INDEX IF EXISTS idx_schedule_events_organization_id;
DROP INDEX IF EXISTS idx_notes_organization_id;
DROP INDEX IF EXISTS idx_todos_organization_id;
DROP INDEX IF EXISTS idx_invoices_organization_id;
DROP INDEX IF EXISTS idx_estimates_organization_id;
DROP INDEX IF EXISTS idx_income_organization_id;
DROP INDEX IF EXISTS idx_expenses_organization_id;
DROP INDEX IF EXISTS idx_message_templates_organization_id;
DROP INDEX IF EXISTS idx_client_photos_organization_id;
DROP INDEX IF EXISTS idx_sent_messages_organization_id;
DROP INDEX IF EXISTS idx_job_service_packages_organization_id;
DROP INDEX IF EXISTS idx_client_job_history_organization_id;
DROP INDEX IF EXISTS idx_productivity_sessions_organization_id;
DROP INDEX IF EXISTS idx_organization_members_user_id;
DROP INDEX IF EXISTS idx_organization_members_organization_id;
DROP INDEX IF EXISTS idx_organizations_join_code;
DROP INDEX IF EXISTS idx_client_job_history_schedule_event_id;
DROP INDEX IF EXISTS idx_client_job_history_service_package_id;
DROP INDEX IF EXISTS idx_client_job_history_time_entry_id;
DROP INDEX IF EXISTS idx_client_photos_productivity_session_id;
DROP INDEX IF EXISTS idx_estimate_items_job_type_id;
DROP INDEX IF EXISTS idx_income_client_id;
DROP INDEX IF EXISTS idx_income_job_id;
DROP INDEX IF EXISTS idx_invoice_items_job_type_id;
DROP INDEX IF EXISTS idx_notes_user_id;
DROP INDEX IF EXISTS idx_organizations_owner_id;
DROP INDEX IF EXISTS idx_schedule_events_client_id_fk;
DROP INDEX IF EXISTS idx_schedule_events_converted_estimate;
DROP INDEX IF EXISTS idx_schedule_events_job_id_fk;
DROP INDEX IF EXISTS idx_schedule_events_job_type_id_fk;
DROP INDEX IF EXISTS idx_schedule_events_service_package_id;
DROP INDEX IF EXISTS idx_user_roles_assigned_by;
DROP INDEX IF EXISTS idx_vehicles_org_id;
DROP INDEX IF EXISTS idx_mileage_readings_user_id;
DROP INDEX IF EXISTS idx_mileage_readings_vehicle_id;
DROP INDEX IF EXISTS idx_mileage_trips_user_id;
DROP INDEX IF EXISTS idx_mileage_trips_vehicle_id;
DROP INDEX IF EXISTS idx_mileage_trips_time_entry_id;
DROP INDEX IF EXISTS idx_mileage_trips_date;
DROP INDEX IF EXISTS idx_time_entries_vehicle_id;
DROP INDEX IF EXISTS idx_business_settings_org_id;

-- =====================================================
-- 8. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Drop and recreate user_is_org_admin_or_owner with stable search_path
-- Use CASCADE to drop dependent policies
DROP FUNCTION IF EXISTS user_is_org_admin_or_owner(uuid) CASCADE;

CREATE OR REPLACE FUNCTION user_is_org_admin_or_owner(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = target_org_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'owner')
  );
END;
$$;

-- Recreate the policies that depended on this function
DROP POLICY IF EXISTS "Admins and owners can update team notes" ON team_notes;
CREATE POLICY "Admins and owners can update team notes"
  ON team_notes
  FOR UPDATE
  TO authenticated
  USING (user_is_org_admin_or_owner(organization_id))
  WITH CHECK (user_is_org_admin_or_owner(organization_id));

DROP POLICY IF EXISTS "Admins and owners can delete team notes" ON team_notes;
CREATE POLICY "Admins and owners can delete team notes"
  ON team_notes
  FOR DELETE
  TO authenticated
  USING (user_is_org_admin_or_owner(organization_id));

-- Drop and recreate update_team_notes_updated_at with stable search_path
DROP FUNCTION IF EXISTS update_team_notes_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_team_notes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_team_notes_updated_at ON team_notes;
CREATE TRIGGER update_team_notes_updated_at
  BEFORE UPDATE ON team_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_team_notes_updated_at();