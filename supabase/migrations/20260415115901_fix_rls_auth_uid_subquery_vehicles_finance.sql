/*
  # Fix RLS Auth UID Subquery - vehicle tables and finance_categories

  Replaces auth.uid() with (select auth.uid()) in RLS policies.
*/

-- vehicle_maintenance_notifications
DROP POLICY IF EXISTS "Org members can insert maintenance notifications" ON public.vehicle_maintenance_notifications;
DROP POLICY IF EXISTS "Org members can view maintenance notifications" ON public.vehicle_maintenance_notifications;

CREATE POLICY "Org members can insert maintenance notifications" ON public.vehicle_maintenance_notifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = vehicle_maintenance_notifications.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view maintenance notifications" ON public.vehicle_maintenance_notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = vehicle_maintenance_notifications.organization_id AND user_id = (SELECT auth.uid())));

-- finance_categories
DROP POLICY IF EXISTS "Org members can view finance categories" ON public.finance_categories;
DROP POLICY IF EXISTS "Owners and managers can delete finance categories" ON public.finance_categories;
DROP POLICY IF EXISTS "Owners and managers can insert finance categories" ON public.finance_categories;
DROP POLICY IF EXISTS "Owners and managers can update finance categories" ON public.finance_categories;

CREATE POLICY "Org members can view finance categories" ON public.finance_categories FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = finance_categories.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Owners and managers can delete finance categories" ON public.finance_categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = finance_categories.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Owners and managers can insert finance categories" ON public.finance_categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = finance_categories.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Owners and managers can update finance categories" ON public.finance_categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = finance_categories.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

-- vehicles
DROP POLICY IF EXISTS "Org members can view org vehicles" ON public.vehicles;

CREATE POLICY "Org members can view org vehicles" ON public.vehicles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = vehicles.organization_id AND user_id = (SELECT auth.uid())));

-- vehicle_service_logs
DROP POLICY IF EXISTS "Org members can delete own service logs" ON public.vehicle_service_logs;
DROP POLICY IF EXISTS "Org members can insert service logs" ON public.vehicle_service_logs;
DROP POLICY IF EXISTS "Org members can update own service logs" ON public.vehicle_service_logs;
DROP POLICY IF EXISTS "Org members can view service logs" ON public.vehicle_service_logs;

CREATE POLICY "Org members can delete own service logs" ON public.vehicle_service_logs FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Org members can insert service logs" ON public.vehicle_service_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update own service logs" ON public.vehicle_service_logs FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Org members can view service logs" ON public.vehicle_service_logs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = (SELECT auth.uid())));

-- vehicle_maintenance_intervals
DROP POLICY IF EXISTS "Org members can delete maintenance intervals" ON public.vehicle_maintenance_intervals;
DROP POLICY IF EXISTS "Org members can insert maintenance intervals" ON public.vehicle_maintenance_intervals;
DROP POLICY IF EXISTS "Org members can update maintenance intervals" ON public.vehicle_maintenance_intervals;
DROP POLICY IF EXISTS "Org members can view maintenance intervals" ON public.vehicle_maintenance_intervals;

CREATE POLICY "Org members can delete maintenance intervals" ON public.vehicle_maintenance_intervals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = vehicle_maintenance_intervals.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert maintenance intervals" ON public.vehicle_maintenance_intervals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = vehicle_maintenance_intervals.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update maintenance intervals" ON public.vehicle_maintenance_intervals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = vehicle_maintenance_intervals.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view maintenance intervals" ON public.vehicle_maintenance_intervals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = vehicle_maintenance_intervals.organization_id AND user_id = (SELECT auth.uid())));
