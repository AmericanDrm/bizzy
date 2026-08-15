/*
  # Fix RLS Auth UID Subquery - departure_reminders, email_unsubscribes, portal tables

  Replaces auth.uid() with (select auth.uid()) in RLS policies.
*/

-- departure_reminders
DROP POLICY IF EXISTS "Users can delete own departure reminders" ON public.departure_reminders;
DROP POLICY IF EXISTS "Users can insert own departure reminders" ON public.departure_reminders;
DROP POLICY IF EXISTS "Users can update own departure reminders" ON public.departure_reminders;
DROP POLICY IF EXISTS "Users can view own departure reminders" ON public.departure_reminders;

CREATE POLICY "Users can delete own departure reminders" ON public.departure_reminders FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own departure reminders" ON public.departure_reminders FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own departure reminders" ON public.departure_reminders FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own departure reminders" ON public.departure_reminders FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- email_unsubscribes
DROP POLICY IF EXISTS "Org owners and admins can delete unsubscribes" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "Org owners and admins can view unsubscribes" ON public.email_unsubscribes;

CREATE POLICY "Org owners and admins can delete unsubscribes" ON public.email_unsubscribes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = email_unsubscribes.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin')));

CREATE POLICY "Org owners and admins can view unsubscribes" ON public.email_unsubscribes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = email_unsubscribes.organization_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','admin')));

-- client_property_qualities
DROP POLICY IF EXISTS "Org members can delete client_property_qualities" ON public.client_property_qualities;
DROP POLICY IF EXISTS "Org members can insert client_property_qualities" ON public.client_property_qualities;
DROP POLICY IF EXISTS "Org members can select client_property_qualities" ON public.client_property_qualities;
DROP POLICY IF EXISTS "Org members can update client_property_qualities" ON public.client_property_qualities;

CREATE POLICY "Org members can delete client_property_qualities" ON public.client_property_qualities FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_property_qualities.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can insert client_property_qualities" ON public.client_property_qualities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_property_qualities.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can select client_property_qualities" ON public.client_property_qualities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_property_qualities.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update client_property_qualities" ON public.client_property_qualities FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = client_property_qualities.organization_id AND user_id = (SELECT auth.uid())));

-- portal_messages
DROP POLICY IF EXISTS "Org members can send portal messages" ON public.portal_messages;
DROP POLICY IF EXISTS "Org members can update portal messages" ON public.portal_messages;
DROP POLICY IF EXISTS "Org members can view portal messages" ON public.portal_messages;
DROP POLICY IF EXISTS "Portal clients can mark messages read" ON public.portal_messages;
DROP POLICY IF EXISTS "Portal clients can send messages" ON public.portal_messages;
DROP POLICY IF EXISTS "Portal clients can view their messages" ON public.portal_messages;

CREATE POLICY "Org members can send portal messages" ON public.portal_messages FOR INSERT TO authenticated
  WITH CHECK (sender_type = 'org' AND EXISTS (SELECT 1 FROM organization_members WHERE organization_id = portal_messages.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can update portal messages" ON public.portal_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = portal_messages.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Org members can view portal messages" ON public.portal_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = portal_messages.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Portal clients can mark messages read" ON public.portal_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM client_portal_accounts WHERE id = portal_messages.portal_account_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Portal clients can send messages" ON public.portal_messages FOR INSERT TO authenticated
  WITH CHECK (sender_type = 'client' AND EXISTS (SELECT 1 FROM client_portal_accounts WHERE id = portal_messages.portal_account_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Portal clients can view their messages" ON public.portal_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM client_portal_accounts WHERE id = portal_messages.portal_account_id AND user_id = (SELECT auth.uid())));
