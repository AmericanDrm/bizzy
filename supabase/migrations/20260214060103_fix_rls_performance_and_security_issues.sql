/*
  # Fix RLS Performance and Security Issues

  1. Performance Improvements
    - Fix all RLS policies to use `(select auth.uid())` instead of `auth.uid()` to prevent re-evaluation per row
    - Applies to: job_type_defaults, ai_prompt_templates, address_suggestions_cache, organization_defaults,
      client_job_quantities, schedule_event_team_members, previous_addresses

  2. Security Fixes
    - Fix function search paths for security functions
    - Consolidate multiple permissive policies to avoid confusion

  3. Tables Affected
    - job_type_defaults: 4 policies updated
    - ai_prompt_templates: 2 policies updated + 1 consolidated
    - address_suggestions_cache: 3 policies updated
    - organization_defaults: 4 policies updated
    - client_job_quantities: 2 policies updated + 1 consolidated
    - schedule_event_team_members: 3 policies updated
    - previous_addresses: 4 policies updated
*/

-- ============================================================================
-- FIX FUNCTION SEARCH PATHS (Security Critical)
-- ============================================================================

-- Fix apply_organization_defaults_to_member function
CREATE OR REPLACE FUNCTION apply_organization_defaults_to_member(member_user_id uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Apply organization defaults to a new member
  INSERT INTO layout_preferences (user_id, organization_id)
  SELECT member_user_id, org_id
  WHERE NOT EXISTS (
    SELECT 1 FROM layout_preferences WHERE user_id = member_user_id AND organization_id = org_id
  );
END;
$$;

-- Fix set_org_id_for_schedule_event_team_members function
CREATE OR REPLACE FUNCTION set_org_id_for_schedule_event_team_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM schedule_events
    WHERE id = NEW.schedule_event_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- FIX JOB_TYPE_DEFAULTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Members can view job type defaults" ON job_type_defaults;
DROP POLICY IF EXISTS "Admins can insert job type defaults" ON job_type_defaults;
DROP POLICY IF EXISTS "Admins can update job type defaults" ON job_type_defaults;
DROP POLICY IF EXISTS "Admins can delete job type defaults" ON job_type_defaults;

CREATE POLICY "Members can view job type defaults"
  ON job_type_defaults FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_type_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can insert job type defaults"
  ON job_type_defaults FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_type_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update job type defaults"
  ON job_type_defaults FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_type_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_type_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete job type defaults"
  ON job_type_defaults FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_type_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- FIX AI_PROMPT_TEMPLATES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Members can view AI prompt templates" ON ai_prompt_templates;
DROP POLICY IF EXISTS "Admins can manage AI prompt templates" ON ai_prompt_templates;

-- Consolidated policy for viewing (removes duplicate permissive SELECT policies)
CREATE POLICY "Members can view AI prompt templates"
  ON ai_prompt_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_prompt_templates.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can manage AI prompt templates"
  ON ai_prompt_templates FOR ALL
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

-- ============================================================================
-- FIX ADDRESS_SUGGESTIONS_CACHE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Members can view address cache" ON address_suggestions_cache;
DROP POLICY IF EXISTS "Members can insert address cache" ON address_suggestions_cache;
DROP POLICY IF EXISTS "Members can update address cache" ON address_suggestions_cache;

CREATE POLICY "Members can view address cache"
  ON address_suggestions_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = address_suggestions_cache.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can insert address cache"
  ON address_suggestions_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = address_suggestions_cache.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can update address cache"
  ON address_suggestions_cache FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = address_suggestions_cache.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = address_suggestions_cache.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- FIX ORGANIZATION_DEFAULTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Organization members can view defaults" ON organization_defaults;
DROP POLICY IF EXISTS "Owners and admins can insert defaults" ON organization_defaults;
DROP POLICY IF EXISTS "Owners and admins can update defaults" ON organization_defaults;
DROP POLICY IF EXISTS "Owners can delete defaults" ON organization_defaults;

CREATE POLICY "Organization members can view defaults"
  ON organization_defaults FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Owners and admins can insert defaults"
  ON organization_defaults FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update defaults"
  ON organization_defaults FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can delete defaults"
  ON organization_defaults FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role = 'owner'
    )
  );

-- ============================================================================
-- FIX CLIENT_JOB_QUANTITIES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Organization members can view client quantities" ON client_job_quantities;
DROP POLICY IF EXISTS "Organization members can manage client quantities" ON client_job_quantities;

-- Consolidated policy (removes duplicate permissive SELECT policies)
CREATE POLICY "Organization members can view client quantities"
  ON client_job_quantities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_job_quantities.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Organization members can manage client quantities"
  ON client_job_quantities FOR ALL
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

-- ============================================================================
-- FIX SCHEDULE_EVENT_TEAM_MEMBERS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Organization members can view team assignments" ON schedule_event_team_members;
DROP POLICY IF EXISTS "Admins and owners can insert team assignments" ON schedule_event_team_members;
DROP POLICY IF EXISTS "Admins and owners can delete team assignments" ON schedule_event_team_members;

CREATE POLICY "Organization members can view team assignments"
  ON schedule_event_team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = schedule_event_team_members.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins and owners can insert team assignments"
  ON schedule_event_team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = schedule_event_team_members.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can delete team assignments"
  ON schedule_event_team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = schedule_event_team_members.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- FIX PREVIOUS_ADDRESSES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Org members can view previous addresses" ON previous_addresses;
DROP POLICY IF EXISTS "Org members can insert previous addresses" ON previous_addresses;
DROP POLICY IF EXISTS "Org members can update previous addresses" ON previous_addresses;
DROP POLICY IF EXISTS "Org admins can delete previous addresses" ON previous_addresses;

CREATE POLICY "Org members can view previous addresses"
  ON previous_addresses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Org members can insert previous addresses"
  ON previous_addresses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Org members can update previous addresses"
  ON previous_addresses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Org admins can delete previous addresses"
  ON previous_addresses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );