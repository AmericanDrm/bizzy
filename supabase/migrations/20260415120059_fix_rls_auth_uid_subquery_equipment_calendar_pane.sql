/*
  # Fix RLS Auth UID Subquery - equipment, calendar, pane pricing, client_pane_type_prices

  Replaces auth.uid() with (select auth.uid()) in RLS policies.
*/

-- equipment_checklist_items
DROP POLICY IF EXISTS "Employees can delete own equipment checklist items" ON public.equipment_checklist_items;
DROP POLICY IF EXISTS "Employees can insert own equipment checklist items" ON public.equipment_checklist_items;
DROP POLICY IF EXISTS "Employees can update own equipment checklist items" ON public.equipment_checklist_items;
DROP POLICY IF EXISTS "Employees can view own equipment checklist items" ON public.equipment_checklist_items;
DROP POLICY IF EXISTS "Managers and owners can view org equipment checklist items" ON public.equipment_checklist_items;

CREATE POLICY "Employees can delete own equipment checklist items" ON public.equipment_checklist_items FOR DELETE TO authenticated
  USING (employee_id = (SELECT auth.uid()));

CREATE POLICY "Employees can insert own equipment checklist items" ON public.equipment_checklist_items FOR INSERT TO authenticated
  WITH CHECK (employee_id = (SELECT auth.uid()));

CREATE POLICY "Employees can update own equipment checklist items" ON public.equipment_checklist_items FOR UPDATE TO authenticated
  USING (employee_id = (SELECT auth.uid()));

CREATE POLICY "Employees can view own equipment checklist items" ON public.equipment_checklist_items FOR SELECT TO authenticated
  USING (employee_id = (SELECT auth.uid()));

CREATE POLICY "Managers and owners can view org equipment checklist items" ON public.equipment_checklist_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_checklist_items.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

-- address_equipment
DROP POLICY IF EXISTS "Org members can delete address equipment" ON public.address_equipment;
DROP POLICY IF EXISTS "Org members can insert address equipment" ON public.address_equipment;
DROP POLICY IF EXISTS "Org members can view address equipment" ON public.address_equipment;

CREATE POLICY "Org members can delete address equipment" ON public.address_equipment FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = address_equipment.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert address equipment" ON public.address_equipment FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = address_equipment.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view address equipment" ON public.address_equipment FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = address_equipment.organization_id AND user_id = (SELECT auth.uid())));

-- client_equipment
DROP POLICY IF EXISTS "Org members can delete client equipment" ON public.client_equipment;
DROP POLICY IF EXISTS "Org members can insert client equipment" ON public.client_equipment;
DROP POLICY IF EXISTS "Org members can view client equipment" ON public.client_equipment;

CREATE POLICY "Org members can delete client equipment" ON public.client_equipment FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_equipment.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert client equipment" ON public.client_equipment FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_equipment.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view client equipment" ON public.client_equipment FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_equipment.organization_id AND user_id = (SELECT auth.uid())));

-- client_address_service_windows
DROP POLICY IF EXISTS "Org admins and managers can delete service windows" ON public.client_address_service_windows;
DROP POLICY IF EXISTS "Org admins and managers can insert service windows" ON public.client_address_service_windows;
DROP POLICY IF EXISTS "Org admins and managers can update service windows" ON public.client_address_service_windows;
DROP POLICY IF EXISTS "Org members can view service windows" ON public.client_address_service_windows;

CREATE POLICY "Org admins and managers can delete service windows" ON public.client_address_service_windows FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_address_service_windows.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Org admins and managers can insert service windows" ON public.client_address_service_windows FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_address_service_windows.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Org admins and managers can update service windows" ON public.client_address_service_windows FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_address_service_windows.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Org members can view service windows" ON public.client_address_service_windows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_address_service_windows.organization_id AND user_id = (SELECT auth.uid())));

-- equipment_inventory
DROP POLICY IF EXISTS "Admins and owners can delete equipment inventory" ON public.equipment_inventory;
DROP POLICY IF EXISTS "Admins and owners can insert equipment inventory" ON public.equipment_inventory;
DROP POLICY IF EXISTS "Admins and owners can update equipment inventory" ON public.equipment_inventory;
DROP POLICY IF EXISTS "Org members can view equipment inventory" ON public.equipment_inventory;

CREATE POLICY "Admins and owners can delete equipment inventory" ON public.equipment_inventory FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_inventory.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin')));

CREATE POLICY "Admins and owners can insert equipment inventory" ON public.equipment_inventory FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_inventory.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin')));

CREATE POLICY "Admins and owners can update equipment inventory" ON public.equipment_inventory FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_inventory.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin')));

CREATE POLICY "Org members can view equipment inventory" ON public.equipment_inventory FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_inventory.organization_id AND user_id = (SELECT auth.uid())));

-- equipment_tags
DROP POLICY IF EXISTS "Org members can delete equipment tags" ON public.equipment_tags;
DROP POLICY IF EXISTS "Org members can insert equipment tags" ON public.equipment_tags;
DROP POLICY IF EXISTS "Org members can update equipment tags" ON public.equipment_tags;
DROP POLICY IF EXISTS "Org members can view equipment tags" ON public.equipment_tags;

CREATE POLICY "Org members can delete equipment tags" ON public.equipment_tags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_tags.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert equipment tags" ON public.equipment_tags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_tags.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update equipment tags" ON public.equipment_tags FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_tags.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view equipment tags" ON public.equipment_tags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_tags.organization_id AND user_id = (SELECT auth.uid())));

-- equipment_tag_assignments
DROP POLICY IF EXISTS "Org members can delete equipment tag assignments" ON public.equipment_tag_assignments;
DROP POLICY IF EXISTS "Org members can insert equipment tag assignments" ON public.equipment_tag_assignments;
DROP POLICY IF EXISTS "Org members can update equipment tag assignments" ON public.equipment_tag_assignments;
DROP POLICY IF EXISTS "Org members can view equipment tag assignments" ON public.equipment_tag_assignments;

CREATE POLICY "Org members can delete equipment tag assignments" ON public.equipment_tag_assignments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_tag_assignments.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert equipment tag assignments" ON public.equipment_tag_assignments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_tag_assignments.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update equipment tag assignments" ON public.equipment_tag_assignments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_tag_assignments.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view equipment tag assignments" ON public.equipment_tag_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_tag_assignments.organization_id AND user_id = (SELECT auth.uid())));

-- equipment_job_type_assignments
DROP POLICY IF EXISTS "Org members can delete equipment job type assignments" ON public.equipment_job_type_assignments;
DROP POLICY IF EXISTS "Org members can insert equipment job type assignments" ON public.equipment_job_type_assignments;
DROP POLICY IF EXISTS "Org members can view equipment job type assignments" ON public.equipment_job_type_assignments;

CREATE POLICY "Org members can delete equipment job type assignments" ON public.equipment_job_type_assignments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_job_type_assignments.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert equipment job type assignments" ON public.equipment_job_type_assignments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_job_type_assignments.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view equipment job type assignments" ON public.equipment_job_type_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = equipment_job_type_assignments.organization_id AND user_id = (SELECT auth.uid())));

-- calendar_sync_settings
DROP POLICY IF EXISTS "Users can delete own sync settings" ON public.calendar_sync_settings;
DROP POLICY IF EXISTS "Users can insert own sync settings" ON public.calendar_sync_settings;
DROP POLICY IF EXISTS "Users can update own sync settings" ON public.calendar_sync_settings;
DROP POLICY IF EXISTS "Users can view own sync settings" ON public.calendar_sync_settings;

CREATE POLICY "Users can delete own sync settings" ON public.calendar_sync_settings FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own sync settings" ON public.calendar_sync_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own sync settings" ON public.calendar_sync_settings FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own sync settings" ON public.calendar_sync_settings FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- organization_pane_pricing
DROP POLICY IF EXISTS "Admins and managers can delete pane pricing" ON public.organization_pane_pricing;
DROP POLICY IF EXISTS "Admins and managers can insert pane pricing" ON public.organization_pane_pricing;
DROP POLICY IF EXISTS "Admins and managers can update pane pricing" ON public.organization_pane_pricing;
DROP POLICY IF EXISTS "Org members can read pane pricing" ON public.organization_pane_pricing;

CREATE POLICY "Admins and managers can delete pane pricing" ON public.organization_pane_pricing FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = organization_pane_pricing.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Admins and managers can insert pane pricing" ON public.organization_pane_pricing FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = organization_pane_pricing.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Admins and managers can update pane pricing" ON public.organization_pane_pricing FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = organization_pane_pricing.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Org members can read pane pricing" ON public.organization_pane_pricing FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = organization_pane_pricing.organization_id AND user_id = (SELECT auth.uid())));

-- client_pane_type_prices
DROP POLICY IF EXISTS "Members can delete client pane type prices in their org" ON public.client_pane_type_prices;
DROP POLICY IF EXISTS "Members can insert client pane type prices in their org" ON public.client_pane_type_prices;
DROP POLICY IF EXISTS "Members can update client pane type prices in their org" ON public.client_pane_type_prices;
DROP POLICY IF EXISTS "Members can view client pane type prices in their org" ON public.client_pane_type_prices;

CREATE POLICY "Members can delete client pane type prices in their org" ON public.client_pane_type_prices FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_pane_type_prices.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Members can insert client pane type prices in their org" ON public.client_pane_type_prices FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_pane_type_prices.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Members can update client pane type prices in their org" ON public.client_pane_type_prices FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_pane_type_prices.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Members can view client pane type prices in their org" ON public.client_pane_type_prices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_pane_type_prices.organization_id AND user_id = (SELECT auth.uid())));
