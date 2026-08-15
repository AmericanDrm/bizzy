/*
  # Optimize RLS Policies - Use (select auth.uid()) Pattern

  1. Changes
    - All RLS policies that call auth.uid() directly are replaced with (select auth.uid())
    - This prevents re-evaluation of auth.uid() for each row, improving query performance
    - Affected tables: profiles, break_entries, business_settings, layout_preferences,
      faq_analytics, walkthrough_analytics, crew_efficiency_rules, invoice_sequence,
      estimate_sequence, client_addresses, organizations, work_orders, push_tokens,
      push_notifications, crew_live_locations

  2. Duplicate Policy Cleanup
    - Removed duplicate policies on client_addresses that targeted the 'public' role
    - Kept only the 'authenticated' role policies (more secure)

  3. Security
    - No changes to policy logic, only optimization of auth function calls
    - client_addresses duplicate 'public' role policies removed (security improvement)
*/

-- ============================================================
-- profiles
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ============================================================
-- break_entries
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own break entries" ON public.break_entries;
CREATE POLICY "Users can delete own break entries"
  ON public.break_entries FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own break entries" ON public.break_entries;
CREATE POLICY "Users can insert own break entries"
  ON public.break_entries FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own break entries" ON public.break_entries;
CREATE POLICY "Users can update own break entries"
  ON public.break_entries FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own break entries" ON public.break_entries;
CREATE POLICY "Users can view own break entries"
  ON public.break_entries FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- business_settings
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert business settings" ON public.business_settings;
CREATE POLICY "Admins and managers can insert business settings"
  ON public.business_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = (select auth.uid())
    AND user_roles.role = ANY (ARRAY['admin'::text, 'manager'::text])
  ));

DROP POLICY IF EXISTS "Admins and managers can update business settings" ON public.business_settings;
CREATE POLICY "Admins and managers can update business settings"
  ON public.business_settings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = (select auth.uid())
    AND user_roles.role = ANY (ARRAY['admin'::text, 'manager'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = (select auth.uid())
    AND user_roles.role = ANY (ARRAY['admin'::text, 'manager'::text])
  ));

-- ============================================================
-- layout_preferences
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own layout preferences" ON public.layout_preferences;
CREATE POLICY "Users can delete own layout preferences"
  ON public.layout_preferences FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own layout preferences" ON public.layout_preferences;
CREATE POLICY "Users can insert own layout preferences"
  ON public.layout_preferences FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own layout preferences" ON public.layout_preferences;
CREATE POLICY "Users can update own layout preferences"
  ON public.layout_preferences FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own layout preferences" ON public.layout_preferences;
CREATE POLICY "Users can view own layout preferences"
  ON public.layout_preferences FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- faq_analytics
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own FAQ analytics" ON public.faq_analytics;
CREATE POLICY "Users can insert own FAQ analytics"
  ON public.faq_analytics FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own FAQ analytics" ON public.faq_analytics;
CREATE POLICY "Users can view own FAQ analytics"
  ON public.faq_analytics FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- walkthrough_analytics
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own walkthrough analytics" ON public.walkthrough_analytics;
CREATE POLICY "Users can insert own walkthrough analytics"
  ON public.walkthrough_analytics FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own walkthrough analytics" ON public.walkthrough_analytics;
CREATE POLICY "Users can view own walkthrough analytics"
  ON public.walkthrough_analytics FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- crew_efficiency_rules
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own crew efficiency rules" ON public.crew_efficiency_rules;
CREATE POLICY "Users can delete own crew efficiency rules"
  ON public.crew_efficiency_rules FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own crew efficiency rules" ON public.crew_efficiency_rules;
CREATE POLICY "Users can insert own crew efficiency rules"
  ON public.crew_efficiency_rules FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own crew efficiency rules" ON public.crew_efficiency_rules;
CREATE POLICY "Users can update own crew efficiency rules"
  ON public.crew_efficiency_rules FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own crew efficiency rules" ON public.crew_efficiency_rules;
CREATE POLICY "Users can view own crew efficiency rules"
  ON public.crew_efficiency_rules FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- invoice_sequence
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own invoice sequences" ON public.invoice_sequence;
CREATE POLICY "Users can insert own invoice sequences"
  ON public.invoice_sequence FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own invoice sequences" ON public.invoice_sequence;
CREATE POLICY "Users can update own invoice sequences"
  ON public.invoice_sequence FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own invoice sequences" ON public.invoice_sequence;
CREATE POLICY "Users can view own invoice sequences"
  ON public.invoice_sequence FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- estimate_sequence
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own estimate sequences" ON public.estimate_sequence;
CREATE POLICY "Users can insert own estimate sequences"
  ON public.estimate_sequence FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own estimate sequences" ON public.estimate_sequence;
CREATE POLICY "Users can update own estimate sequences"
  ON public.estimate_sequence FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own estimate sequences" ON public.estimate_sequence;
CREATE POLICY "Users can view own estimate sequences"
  ON public.estimate_sequence FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- client_addresses - also remove duplicate public-role policies
-- ============================================================
DROP POLICY IF EXISTS "Users can delete their own addresses" ON public.client_addresses;
DROP POLICY IF EXISTS "Users can insert their own addresses" ON public.client_addresses;
DROP POLICY IF EXISTS "Users can update their own addresses" ON public.client_addresses;
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.client_addresses;

DROP POLICY IF EXISTS "Users can delete own client addresses" ON public.client_addresses;
CREATE POLICY "Users can delete own client addresses"
  ON public.client_addresses FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own client addresses" ON public.client_addresses;
CREATE POLICY "Users can insert own client addresses"
  ON public.client_addresses FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own client addresses" ON public.client_addresses;
CREATE POLICY "Users can update own client addresses"
  ON public.client_addresses FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own client addresses" ON public.client_addresses;
CREATE POLICY "Users can view own client addresses"
  ON public.client_addresses FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- organizations
-- ============================================================
DROP POLICY IF EXISTS "Organization owners can update organization" ON public.organizations;
CREATE POLICY "Organization owners can update organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = (select auth.uid())
    AND organization_members.role = 'owner'::text
  ));

DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
CREATE POLICY "Users can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (id IN (
    SELECT organization_members.organization_id
    FROM public.organization_members
    WHERE organization_members.user_id = (select auth.uid())
  ));

-- ============================================================
-- work_orders
-- ============================================================
DROP POLICY IF EXISTS "Organization members can delete work orders" ON public.work_orders;
CREATE POLICY "Organization members can delete work orders"
  ON public.work_orders FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = work_orders.organization_id
    AND organization_members.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Organization members can insert work orders" ON public.work_orders;
CREATE POLICY "Organization members can insert work orders"
  ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = work_orders.organization_id
    AND organization_members.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Organization members can update work orders" ON public.work_orders;
CREATE POLICY "Organization members can update work orders"
  ON public.work_orders FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = work_orders.organization_id
    AND organization_members.user_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = work_orders.organization_id
    AND organization_members.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Organization members can view work orders" ON public.work_orders;
CREATE POLICY "Organization members can view work orders"
  ON public.work_orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = work_orders.organization_id
    AND organization_members.user_id = (select auth.uid())
  ));

-- ============================================================
-- push_tokens
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete own push tokens"
  ON public.push_tokens FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
CREATE POLICY "Users can insert own push tokens"
  ON public.push_tokens FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;
CREATE POLICY "Users can update own push tokens"
  ON public.push_tokens FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own push tokens" ON public.push_tokens;
CREATE POLICY "Users can view own push tokens"
  ON public.push_tokens FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- push_notifications
-- ============================================================
DROP POLICY IF EXISTS "Users can update own notifications" ON public.push_notifications;
CREATE POLICY "Users can update own notifications"
  ON public.push_notifications FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.push_notifications;
CREATE POLICY "Users can view own notifications"
  ON public.push_notifications FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- crew_live_locations
-- ============================================================
DROP POLICY IF EXISTS "Admins can view org live locations" ON public.crew_live_locations;
CREATE POLICY "Admins can view org live locations"
  ON public.crew_live_locations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = crew_live_locations.organization_id
    AND om.user_id = (select auth.uid())
    AND om.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ));

DROP POLICY IF EXISTS "Users can delete own live location" ON public.crew_live_locations;
CREATE POLICY "Users can delete own live location"
  ON public.crew_live_locations FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own live location" ON public.crew_live_locations;
CREATE POLICY "Users can insert own live location"
  ON public.crew_live_locations FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own live location" ON public.crew_live_locations;
CREATE POLICY "Users can update own live location"
  ON public.crew_live_locations FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own live location" ON public.crew_live_locations;
CREATE POLICY "Users can view own live location"
  ON public.crew_live_locations FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
