/*
  # Fix location_audit_logs RLS and Performance Issues

  ## Summary
  1. Fixes Auth RLS Initialization Plan issues by wrapping auth.uid() calls in SELECT subqueries
  2. Drops duplicate/unused indexes on location_audit_logs
  3. Fixes multiple permissive policies for SELECT by merging into a single policy
  4. Drops unused indexes on route_templates, route_stops, route_optimization_runs, and todos

  ## Changes
  - Drop and recreate all location_audit_logs RLS policies with optimized auth.uid() usage
  - Merge two SELECT policies into one consolidated policy
  - Remove unused indexes to reduce write overhead
*/

-- Drop existing RLS policies on location_audit_logs
DROP POLICY IF EXISTS "Admins can view organization location audit logs" ON public.location_audit_logs;
DROP POLICY IF EXISTS "Users can insert own location audit logs" ON public.location_audit_logs;
DROP POLICY IF EXISTS "Users can update own location audit logs" ON public.location_audit_logs;
DROP POLICY IF EXISTS "Users can view own location audit logs" ON public.location_audit_logs;

-- Recreate SELECT policy merging both admin and user view into one (fixes multiple permissive policies)
CREATE POLICY "Users can view location audit logs"
  ON public.location_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = location_audit_logs.organization_id
        AND om.user_id = (select auth.uid())
        AND om.role IN ('admin', 'owner')
    )
  );

-- Recreate INSERT policy with optimized auth.uid()
CREATE POLICY "Users can insert own location audit logs"
  ON public.location_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Recreate UPDATE policy with optimized auth.uid()
CREATE POLICY "Users can update own location audit logs"
  ON public.location_audit_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Drop unused indexes on location_audit_logs
DROP INDEX IF EXISTS public.idx_location_audit_logs_stop_id;
DROP INDEX IF EXISTS public.idx_location_audit_logs_user_id;
DROP INDEX IF EXISTS public.idx_location_audit_logs_time_entry_id;
DROP INDEX IF EXISTS public.idx_location_audit_logs_detected_at;
DROP INDEX IF EXISTS public.idx_location_audit_logs_org_id;

-- Drop unused indexes on route tables
DROP INDEX IF EXISTS public.idx_route_templates_created_by;
DROP INDEX IF EXISTS public.idx_route_templates_status;
DROP INDEX IF EXISTS public.idx_route_templates_scheduled_date;
DROP INDEX IF EXISTS public.idx_route_stops_route_id;
DROP INDEX IF EXISTS public.idx_route_stops_client_id;
DROP INDEX IF EXISTS public.idx_route_stops_order;
DROP INDEX IF EXISTS public.idx_route_optimization_runs_org_id;

-- Drop unused index on todos
DROP INDEX IF EXISTS public.idx_todos_client_id;
