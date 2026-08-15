/*
  # Fix Multiple Permissive Policies

  Consolidates multiple permissive policies on the same table/action/role into single policies
  to avoid performance and ambiguity issues.

  ## Tables fixed:
  - equipment_checklist_items SELECT (employee own + manager org view -> single combined)
  - vehicles SELECT (members_select + Org members can view -> remove redundant)
  - geofence_job_sessions SELECT and UPDATE (own + manager -> already handled, ensure single each)
*/

-- equipment_checklist_items: consolidate the two SELECT policies into one
DROP POLICY IF EXISTS "Employees can view own equipment checklist items" ON public.equipment_checklist_items;
DROP POLICY IF EXISTS "Managers and owners can view org equipment checklist items" ON public.equipment_checklist_items;

CREATE POLICY "Org members can view equipment checklist items" ON public.equipment_checklist_items FOR SELECT TO authenticated
  USING (
    employee_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = equipment_checklist_items.organization_id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner','admin','manager')
    )
  );

-- vehicles: remove the now-redundant "Org members can view org vehicles" since members_select covers it
-- The "Org members can view org vehicles" has a broader check including user_id = auth.uid() which
-- is redundant since is_org_member already covers members. Drop the custom one to leave only members_select.
DROP POLICY IF EXISTS "Org members can view org vehicles" ON public.vehicles;

-- geofence_job_sessions SELECT: consolidate own + manager into one policy
DROP POLICY IF EXISTS "Users can view own geofence sessions" ON public.geofence_job_sessions;
DROP POLICY IF EXISTS "Managers can view org geofence sessions" ON public.geofence_job_sessions;

CREATE POLICY "Org members can view geofence sessions" ON public.geofence_job_sessions FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = geofence_job_sessions.organization_id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner','admin','manager')
    )
  );

-- geofence_job_sessions UPDATE: consolidate own + manager into one policy
DROP POLICY IF EXISTS "Users can update own geofence sessions" ON public.geofence_job_sessions;
DROP POLICY IF EXISTS "Managers can update org geofence sessions" ON public.geofence_job_sessions;

CREATE POLICY "Org members can update geofence sessions" ON public.geofence_job_sessions FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = geofence_job_sessions.organization_id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner','admin','manager')
    )
  );
