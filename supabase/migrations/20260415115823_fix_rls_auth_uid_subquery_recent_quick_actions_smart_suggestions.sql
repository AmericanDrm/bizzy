/*
  # Fix RLS Auth UID Subquery - recent_quick_actions and smart_suggestions_cache

  Replaces auth.uid() with (select auth.uid()) in RLS policies.
*/

-- recent_quick_actions
DROP POLICY IF EXISTS "Users can delete own recent actions" ON public.recent_quick_actions;
DROP POLICY IF EXISTS "Users can insert own recent actions" ON public.recent_quick_actions;
DROP POLICY IF EXISTS "Users can read own recent actions" ON public.recent_quick_actions;
DROP POLICY IF EXISTS "Users can update own recent actions" ON public.recent_quick_actions;

CREATE POLICY "Users can delete own recent actions" ON public.recent_quick_actions FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own recent actions" ON public.recent_quick_actions FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read own recent actions" ON public.recent_quick_actions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own recent actions" ON public.recent_quick_actions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- smart_suggestions_cache
DROP POLICY IF EXISTS "Users can delete own suggestions" ON public.smart_suggestions_cache;
DROP POLICY IF EXISTS "Users can insert own suggestions" ON public.smart_suggestions_cache;
DROP POLICY IF EXISTS "Users can read own org suggestions" ON public.smart_suggestions_cache;
DROP POLICY IF EXISTS "Users can update own suggestions" ON public.smart_suggestions_cache;

CREATE POLICY "Users can delete own suggestions" ON public.smart_suggestions_cache FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own suggestions" ON public.smart_suggestions_cache FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read own org suggestions" ON public.smart_suggestions_cache FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM organization_members WHERE organization_id = smart_suggestions_cache.organization_id AND user_id = (SELECT auth.uid())));

CREATE POLICY "Users can update own suggestions" ON public.smart_suggestions_cache FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
