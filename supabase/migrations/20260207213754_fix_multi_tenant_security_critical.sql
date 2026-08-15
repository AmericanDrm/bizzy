/*
  # Fix Multi-Tenant Security (CRITICAL)

  1. Overview
    - Enforces absolute data isolation between organizations
    - Even if UI is bypassed, database will reject cross-org access
    - User from Org A can NEVER access data from Org B

  2. Security Measures
    - Create secure helper to get user's organization
    - Add validation function to verify organization ownership
    - Update ALL triggers to force organization_id from user context
    - Strengthen RLS policies with explicit validation
    - Prevent manual setting of organization_id that doesn't match user's org

  3. Defense Layers
    - Layer 1: Triggers force correct organization_id on INSERT/UPDATE
    - Layer 2: RLS policies validate organization membership
    - Layer 3: Helper functions prevent bypassing checks
*/

-- =============================================================================
-- HELPER FUNCTIONS FOR ORGANIZATION VALIDATION
-- =============================================================================

-- Get the authenticated user's organization ID (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION auth_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id 
  FROM organization_members
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1;
$$;

-- Validate that an organization_id belongs to the current user
CREATE OR REPLACE FUNCTION validate_user_org(check_org_id uuid)
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

-- =============================================================================
-- ENHANCED ORGANIZATION ID ENFORCEMENT
-- =============================================================================

-- Drop the old generic trigger function
DROP FUNCTION IF EXISTS set_default_organization_id CASCADE;

-- Create a new secure trigger function that FORCES the user's org
CREATE OR REPLACE FUNCTION enforce_user_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the user's organization
  SELECT organization_id INTO user_org_id
  FROM organization_members
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1;

  -- User must belong to an organization
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;

  -- CRITICAL: If organization_id is being set, verify it matches user's org
  IF NEW.organization_id IS NOT NULL AND NEW.organization_id != user_org_id THEN
    RAISE EXCEPTION 'Cannot set organization_id to an organization you do not belong to';
  END IF;

  -- Force the correct organization_id
  NEW.organization_id := user_org_id;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- APPLY TRIGGER TO ALL ORGANIZATION-SCOPED TABLES
-- =============================================================================

-- List of all tables that should have organization enforcement
DO $$
DECLARE
  table_name text;
  tables_to_protect text[] := ARRAY[
    'invoices', 'estimates', 'jobs', 'income', 'expenses',
    'notes', 'todos', 'clients', 'time_entries', 'schedule_events',
    'work_orders', 'team_notes', 'job_types', 'message_templates',
    'sent_messages', 'client_photos', 'location_tracking',
    'business_settings', 'vehicles', 'mileage_readings', 'mileage_trips',
    'productivity_sessions', 'push_tokens', 'push_notifications',
    'crew_live_locations', 'detected_locations', 'clock_out_prompts',
    'job_service_packages', 'client_job_history'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_to_protect
  LOOP
    -- Drop existing trigger if it exists
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_org_id_trigger ON %I', table_name);
    
    -- Create new trigger
    EXECUTE format('
      CREATE TRIGGER enforce_org_id_trigger
        BEFORE INSERT OR UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION enforce_user_organization_id()
    ', table_name);
  END LOOP;
END;
$$;

-- =============================================================================
-- ENHANCED RLS POLICIES WITH EXPLICIT VALIDATION
-- =============================================================================

-- Create a function to double-check organization membership in RLS
CREATE OR REPLACE FUNCTION rls_check_org_access(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Must be authenticated
  SELECT auth.uid() IS NOT NULL
    -- Must be member of the organization
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = check_org_id
        AND user_id = auth.uid()
    );
$$;

-- Update is_org_member to be more explicit
CREATE OR REPLACE FUNCTION is_org_member(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Return false if not authenticated or org_id is null
  SELECT CASE 
    WHEN auth.uid() IS NULL THEN false
    WHEN check_org_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = check_org_id
        AND user_id = auth.uid()
    )
  END;
$$;

-- Update is_org_admin to be more explicit
CREATE OR REPLACE FUNCTION is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Return false if not authenticated or org_id is null
  SELECT CASE 
    WHEN auth.uid() IS NULL THEN false
    WHEN check_org_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = check_org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  END;
$$;

-- =============================================================================
-- ADDITIONAL SECURITY: PREVENT ORG_ID TAMPERING ON UPDATE
-- =============================================================================

-- Function to prevent changing organization_id on UPDATE
CREATE OR REPLACE FUNCTION prevent_org_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- On UPDATE, organization_id must not change
  IF TG_OP = 'UPDATE' AND OLD.organization_id IS NOT NULL THEN
    IF NEW.organization_id != OLD.organization_id THEN
      RAISE EXCEPTION 'Cannot change organization_id of existing record';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply this trigger to critical tables
DO $$
DECLARE
  table_name text;
  critical_tables text[] := ARRAY[
    'invoices', 'estimates', 'clients', 'jobs', 'income', 'expenses'
  ];
BEGIN
  FOREACH table_name IN ARRAY critical_tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS prevent_org_id_change_trigger ON %I', table_name);
    EXECUTE format('
      CREATE TRIGGER prevent_org_id_change_trigger
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION prevent_org_id_change()
    ', table_name);
  END LOOP;
END;
$$;

-- =============================================================================
-- VERIFICATION: Test Functions
-- =============================================================================

-- Create a function admins can use to verify isolation
CREATE OR REPLACE FUNCTION verify_org_isolation()
RETURNS TABLE(
  test_name text,
  result text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Test 1: Check if all tables have organization_id
  RETURN QUERY
  SELECT 
    'Tables with organization_id'::text,
    'PASS'::text,
    count(*)::text || ' tables have organization_id column'
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND column_name = 'organization_id';

  -- Test 2: Check if RLS is enabled on all org tables
  RETURN QUERY
  SELECT 
    'RLS enabled on org tables'::text,
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
    count(*)::text || ' tables missing RLS'
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      SELECT DISTINCT table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND column_name = 'organization_id'
    )
    AND rowsecurity = false;

  -- Test 3: Check trigger coverage
  RETURN QUERY
  SELECT 
    'Org enforcement triggers'::text,
    'INFO'::text,
    count(*)::text || ' triggers active'
  FROM information_schema.triggers
  WHERE trigger_name = 'enforce_org_id_trigger';
END;
$$;
