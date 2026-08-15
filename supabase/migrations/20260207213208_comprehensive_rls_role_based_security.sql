/*
  # Comprehensive RLS Role-Based Security

  1. Overview
    - Fixes all RLS policies to use role-based access control
    - Users can ONLY access data from their organization
    - Owners and Admins: Full CRUD permissions
    - Members: Can create and read, but NOT delete

  2. Changes
    - Create security definer helper functions to check roles without recursion
    - Drop all existing org_* policies on all tables
    - Create new role-based policies (separate for admin vs member)
    - Ensure consistent security across all tables

  3. Tables Covered
    - invoices, estimates, jobs, income, expenses
    - notes, todos, clients, time_entries
    - schedule_events, work_orders, team_notes
    - All other organization-scoped tables
*/

-- =============================================================================
-- HELPER FUNCTIONS (Security Definer to avoid recursion)
-- =============================================================================

-- Check if user is member of organization (any role)
CREATE OR REPLACE FUNCTION is_org_member(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
  );
$$;

-- Check if user is admin or owner of organization
CREATE OR REPLACE FUNCTION is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

-- Get user's organization_id (returns first org if multiple)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id 
  FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- =============================================================================
-- INVOICES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON invoices;
DROP POLICY IF EXISTS "org_insert" ON invoices;
DROP POLICY IF EXISTS "org_update" ON invoices;
DROP POLICY IF EXISTS "org_delete" ON invoices;

-- All org members can view invoices
CREATE POLICY "members_select" ON invoices
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

-- All org members can create invoices
CREATE POLICY "members_insert" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

-- All org members can update invoices
CREATE POLICY "members_update" ON invoices
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

-- Only admins and owners can delete invoices
CREATE POLICY "admins_delete" ON invoices
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- ESTIMATES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON estimates;
DROP POLICY IF EXISTS "org_insert" ON estimates;
DROP POLICY IF EXISTS "org_update" ON estimates;
DROP POLICY IF EXISTS "org_delete" ON estimates;

CREATE POLICY "members_select" ON estimates
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON estimates
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON estimates
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON estimates
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- JOBS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON jobs;
DROP POLICY IF EXISTS "org_insert" ON jobs;
DROP POLICY IF EXISTS "org_update" ON jobs;
DROP POLICY IF EXISTS "org_delete" ON jobs;

CREATE POLICY "members_select" ON jobs
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON jobs
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON jobs
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON jobs
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- INCOME POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON income;
DROP POLICY IF EXISTS "org_insert" ON income;
DROP POLICY IF EXISTS "org_update" ON income;
DROP POLICY IF EXISTS "org_delete" ON income;

CREATE POLICY "members_select" ON income
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON income
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON income
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON income
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- EXPENSES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON expenses;
DROP POLICY IF EXISTS "org_insert" ON expenses;
DROP POLICY IF EXISTS "org_update" ON expenses;
DROP POLICY IF EXISTS "org_delete" ON expenses;

CREATE POLICY "members_select" ON expenses
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON expenses
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON expenses
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- NOTES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON notes;
DROP POLICY IF EXISTS "org_insert" ON notes;
DROP POLICY IF EXISTS "org_update" ON notes;
DROP POLICY IF EXISTS "org_delete" ON notes;

CREATE POLICY "members_select" ON notes
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON notes
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON notes
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON notes
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- TODOS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON todos;
DROP POLICY IF EXISTS "org_insert" ON todos;
DROP POLICY IF EXISTS "org_update" ON todos;
DROP POLICY IF EXISTS "org_delete" ON todos;

CREATE POLICY "members_select" ON todos
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON todos
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON todos
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON todos
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- CLIENTS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON clients;
DROP POLICY IF EXISTS "org_insert" ON clients;
DROP POLICY IF EXISTS "org_update" ON clients;
DROP POLICY IF EXISTS "org_delete" ON clients;

CREATE POLICY "members_select" ON clients
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON clients
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON clients
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- TIME_ENTRIES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON time_entries;
DROP POLICY IF EXISTS "org_insert" ON time_entries;
DROP POLICY IF EXISTS "org_update" ON time_entries;
DROP POLICY IF EXISTS "org_delete" ON time_entries;

CREATE POLICY "members_select" ON time_entries
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON time_entries
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON time_entries
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON time_entries
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- SCHEDULE_EVENTS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON schedule_events;
DROP POLICY IF EXISTS "org_insert" ON schedule_events;
DROP POLICY IF EXISTS "org_update" ON schedule_events;
DROP POLICY IF EXISTS "org_delete" ON schedule_events;

CREATE POLICY "members_select" ON schedule_events
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON schedule_events
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON schedule_events
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON schedule_events
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- WORK_ORDERS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON work_orders;
DROP POLICY IF EXISTS "org_insert" ON work_orders;
DROP POLICY IF EXISTS "org_update" ON work_orders;
DROP POLICY IF EXISTS "org_delete" ON work_orders;

CREATE POLICY "members_select" ON work_orders
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON work_orders
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON work_orders
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON work_orders
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- TEAM_NOTES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_select" ON team_notes;
DROP POLICY IF EXISTS "org_insert" ON team_notes;
DROP POLICY IF EXISTS "org_update" ON team_notes;
DROP POLICY IF EXISTS "org_delete" ON team_notes;

CREATE POLICY "members_select" ON team_notes
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "members_insert" ON team_notes
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "members_update" ON team_notes
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "admins_delete" ON team_notes
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- =============================================================================
-- ADDITIONAL TABLES WITH SIMILAR PATTERNS
-- =============================================================================

-- JOB_TYPES
DROP POLICY IF EXISTS "org_select" ON job_types;
DROP POLICY IF EXISTS "org_insert" ON job_types;
DROP POLICY IF EXISTS "org_update" ON job_types;
DROP POLICY IF EXISTS "org_delete" ON job_types;

CREATE POLICY "members_select" ON job_types FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON job_types FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON job_types FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON job_types FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- MESSAGE_TEMPLATES
DROP POLICY IF EXISTS "org_select" ON message_templates;
DROP POLICY IF EXISTS "org_insert" ON message_templates;
DROP POLICY IF EXISTS "org_update" ON message_templates;
DROP POLICY IF EXISTS "org_delete" ON message_templates;

CREATE POLICY "members_select" ON message_templates FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON message_templates FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON message_templates FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON message_templates FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- SENT_MESSAGES
DROP POLICY IF EXISTS "org_select" ON sent_messages;
DROP POLICY IF EXISTS "org_insert" ON sent_messages;
DROP POLICY IF EXISTS "org_update" ON sent_messages;
DROP POLICY IF EXISTS "org_delete" ON sent_messages;

CREATE POLICY "members_select" ON sent_messages FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON sent_messages FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON sent_messages FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON sent_messages FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- CLIENT_PHOTOS
DROP POLICY IF EXISTS "org_select" ON client_photos;
DROP POLICY IF EXISTS "org_insert" ON client_photos;
DROP POLICY IF EXISTS "org_update" ON client_photos;
DROP POLICY IF EXISTS "org_delete" ON client_photos;

CREATE POLICY "members_select" ON client_photos FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON client_photos FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON client_photos FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON client_photos FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- LOCATION_TRACKING
DROP POLICY IF EXISTS "org_select" ON location_tracking;
DROP POLICY IF EXISTS "org_insert" ON location_tracking;
DROP POLICY IF EXISTS "org_update" ON location_tracking;
DROP POLICY IF EXISTS "org_delete" ON location_tracking;

CREATE POLICY "members_select" ON location_tracking FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON location_tracking FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON location_tracking FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON location_tracking FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- BUSINESS_SETTINGS
DROP POLICY IF EXISTS "org_select" ON business_settings;
DROP POLICY IF EXISTS "org_insert" ON business_settings;
DROP POLICY IF EXISTS "org_update" ON business_settings;
DROP POLICY IF EXISTS "org_delete" ON business_settings;

CREATE POLICY "members_select" ON business_settings FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON business_settings FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_update" ON business_settings FOR UPDATE TO authenticated USING (is_org_admin(organization_id)) WITH CHECK (is_org_admin(organization_id));
CREATE POLICY "admins_delete" ON business_settings FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- VEHICLES
DROP POLICY IF EXISTS "org_select" ON vehicles;
DROP POLICY IF EXISTS "org_insert" ON vehicles;
DROP POLICY IF EXISTS "org_update" ON vehicles;
DROP POLICY IF EXISTS "org_delete" ON vehicles;

CREATE POLICY "members_select" ON vehicles FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON vehicles FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON vehicles FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON vehicles FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- MILEAGE_READINGS
DROP POLICY IF EXISTS "org_select" ON mileage_readings;
DROP POLICY IF EXISTS "org_insert" ON mileage_readings;
DROP POLICY IF EXISTS "org_update" ON mileage_readings;
DROP POLICY IF EXISTS "org_delete" ON mileage_readings;

CREATE POLICY "members_select" ON mileage_readings FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON mileage_readings FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON mileage_readings FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON mileage_readings FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- MILEAGE_TRIPS
DROP POLICY IF EXISTS "org_select" ON mileage_trips;
DROP POLICY IF EXISTS "org_insert" ON mileage_trips;
DROP POLICY IF EXISTS "org_update" ON mileage_trips;
DROP POLICY IF EXISTS "org_delete" ON mileage_trips;

CREATE POLICY "members_select" ON mileage_trips FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON mileage_trips FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON mileage_trips FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON mileage_trips FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- PRODUCTIVITY_SESSIONS
DROP POLICY IF EXISTS "org_select" ON productivity_sessions;
DROP POLICY IF EXISTS "org_insert" ON productivity_sessions;
DROP POLICY IF EXISTS "org_update" ON productivity_sessions;
DROP POLICY IF EXISTS "org_delete" ON productivity_sessions;

CREATE POLICY "members_select" ON productivity_sessions FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON productivity_sessions FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON productivity_sessions FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON productivity_sessions FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- PUSH_TOKENS
DROP POLICY IF EXISTS "org_select" ON push_tokens;
DROP POLICY IF EXISTS "org_insert" ON push_tokens;
DROP POLICY IF EXISTS "org_update" ON push_tokens;
DROP POLICY IF EXISTS "org_delete" ON push_tokens;

CREATE POLICY "members_select" ON push_tokens FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON push_tokens FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON push_tokens FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON push_tokens FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- PUSH_NOTIFICATIONS
DROP POLICY IF EXISTS "org_select" ON push_notifications;
DROP POLICY IF EXISTS "org_insert" ON push_notifications;
DROP POLICY IF EXISTS "org_update" ON push_notifications;
DROP POLICY IF EXISTS "org_delete" ON push_notifications;

CREATE POLICY "members_select" ON push_notifications FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON push_notifications FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON push_notifications FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON push_notifications FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- CREW_LIVE_LOCATIONS
DROP POLICY IF EXISTS "org_select" ON crew_live_locations;
DROP POLICY IF EXISTS "org_insert" ON crew_live_locations;
DROP POLICY IF EXISTS "org_update" ON crew_live_locations;
DROP POLICY IF EXISTS "org_delete" ON crew_live_locations;

CREATE POLICY "members_select" ON crew_live_locations FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON crew_live_locations FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON crew_live_locations FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON crew_live_locations FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- DETECTED_LOCATIONS
DROP POLICY IF EXISTS "org_select" ON detected_locations;
DROP POLICY IF EXISTS "org_insert" ON detected_locations;
DROP POLICY IF EXISTS "org_update" ON detected_locations;
DROP POLICY IF EXISTS "org_delete" ON detected_locations;

CREATE POLICY "members_select" ON detected_locations FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON detected_locations FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON detected_locations FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON detected_locations FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- CLOCK_OUT_PROMPTS
DROP POLICY IF EXISTS "org_select" ON clock_out_prompts;
DROP POLICY IF EXISTS "org_insert" ON clock_out_prompts;
DROP POLICY IF EXISTS "org_update" ON clock_out_prompts;
DROP POLICY IF EXISTS "org_delete" ON clock_out_prompts;

CREATE POLICY "members_select" ON clock_out_prompts FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON clock_out_prompts FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON clock_out_prompts FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON clock_out_prompts FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- JOB_SERVICE_PACKAGES
DROP POLICY IF EXISTS "org_select" ON job_service_packages;
DROP POLICY IF EXISTS "org_insert" ON job_service_packages;
DROP POLICY IF EXISTS "org_update" ON job_service_packages;
DROP POLICY IF EXISTS "org_delete" ON job_service_packages;

CREATE POLICY "members_select" ON job_service_packages FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON job_service_packages FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON job_service_packages FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON job_service_packages FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- CLIENT_JOB_HISTORY
DROP POLICY IF EXISTS "org_select" ON client_job_history;
DROP POLICY IF EXISTS "org_insert" ON client_job_history;
DROP POLICY IF EXISTS "org_update" ON client_job_history;
DROP POLICY IF EXISTS "org_delete" ON client_job_history;

CREATE POLICY "members_select" ON client_job_history FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "members_insert" ON client_job_history FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "members_update" ON client_job_history FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
CREATE POLICY "admins_delete" ON client_job_history FOR DELETE TO authenticated USING (is_org_admin(organization_id));
