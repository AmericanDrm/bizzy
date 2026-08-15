/*
  # Fix RLS Auth UID Subquery - shopping lists, supply catalog, schedule line items

  Replaces auth.uid() with (select auth.uid()) in RLS policies.
*/

-- shopping_lists
DROP POLICY IF EXISTS "Managers and above can delete shopping lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Org members can insert shopping lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Org members can update shopping lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Org members can view shopping lists" ON public.shopping_lists;

CREATE POLICY "Managers and above can delete shopping lists" ON public.shopping_lists FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = shopping_lists.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Org members can insert shopping lists" ON public.shopping_lists FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = shopping_lists.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update shopping lists" ON public.shopping_lists FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = shopping_lists.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view shopping lists" ON public.shopping_lists FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = shopping_lists.organization_id AND user_id = (SELECT auth.uid())));

-- shopping_list_items
DROP POLICY IF EXISTS "Org members can delete shopping list items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Org members can insert shopping list items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Org members can update shopping list items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Org members can view shopping list items" ON public.shopping_list_items;

CREATE POLICY "Org members can delete shopping list items" ON public.shopping_list_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = shopping_list_items.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert shopping list items" ON public.shopping_list_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = shopping_list_items.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update shopping list items" ON public.shopping_list_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = shopping_list_items.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view shopping list items" ON public.shopping_list_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = shopping_list_items.organization_id AND user_id = (SELECT auth.uid())));

-- supply_catalog
DROP POLICY IF EXISTS "Managers and above can delete supply catalog" ON public.supply_catalog;
DROP POLICY IF EXISTS "Org members can insert supply catalog" ON public.supply_catalog;
DROP POLICY IF EXISTS "Org members can update supply catalog" ON public.supply_catalog;
DROP POLICY IF EXISTS "Org members can view supply catalog" ON public.supply_catalog;

CREATE POLICY "Managers and above can delete supply catalog" ON public.supply_catalog FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = supply_catalog.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin','manager')));

CREATE POLICY "Org members can insert supply catalog" ON public.supply_catalog FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = supply_catalog.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update supply catalog" ON public.supply_catalog FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = supply_catalog.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view supply catalog" ON public.supply_catalog FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = supply_catalog.organization_id AND user_id = (SELECT auth.uid())));

-- schedule_event_line_items
DROP POLICY IF EXISTS "Organization members can delete line items" ON public.schedule_event_line_items;
DROP POLICY IF EXISTS "Organization members can insert line items" ON public.schedule_event_line_items;
DROP POLICY IF EXISTS "Organization members can update line items" ON public.schedule_event_line_items;
DROP POLICY IF EXISTS "Organization members can view line items" ON public.schedule_event_line_items;

CREATE POLICY "Organization members can delete line items" ON public.schedule_event_line_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = schedule_event_line_items.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Organization members can insert line items" ON public.schedule_event_line_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = schedule_event_line_items.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Organization members can update line items" ON public.schedule_event_line_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = schedule_event_line_items.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Organization members can view line items" ON public.schedule_event_line_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = schedule_event_line_items.organization_id AND user_id = (SELECT auth.uid())));
