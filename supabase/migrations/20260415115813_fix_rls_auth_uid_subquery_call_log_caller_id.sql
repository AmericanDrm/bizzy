/*
  # Fix RLS Auth UID Subquery - call_log and caller_id_settings

  Replaces auth.uid() with (select auth.uid()) in RLS policies for:
  - call_log
  - caller_id_settings

  This prevents per-row re-evaluation of auth functions, improving query performance.
*/

-- call_log
DROP POLICY IF EXISTS "Users can delete call logs in their org" ON public.call_log;
DROP POLICY IF EXISTS "Users can insert call logs in their org" ON public.call_log;
DROP POLICY IF EXISTS "Users can update call logs in their org" ON public.call_log;
DROP POLICY IF EXISTS "Users can view call logs in their org" ON public.call_log;

CREATE POLICY "Users can delete call logs in their org" ON public.call_log FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = call_log.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Users can insert call logs in their org" ON public.call_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = call_log.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Users can update call logs in their org" ON public.call_log FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = call_log.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Users can view call logs in their org" ON public.call_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_id = call_log.organization_id AND user_id = (SELECT auth.uid())));

-- caller_id_settings
DROP POLICY IF EXISTS "Users can delete their own caller ID settings" ON public.caller_id_settings;
DROP POLICY IF EXISTS "Users can insert their own caller ID settings" ON public.caller_id_settings;
DROP POLICY IF EXISTS "Users can update their own caller ID settings" ON public.caller_id_settings;
DROP POLICY IF EXISTS "Users can view their own caller ID settings" ON public.caller_id_settings;

CREATE POLICY "Users can delete their own caller ID settings" ON public.caller_id_settings FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own caller ID settings" ON public.caller_id_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own caller ID settings" ON public.caller_id_settings FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their own caller ID settings" ON public.caller_id_settings FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
