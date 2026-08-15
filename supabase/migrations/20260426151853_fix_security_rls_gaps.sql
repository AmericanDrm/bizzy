/*
  # Fix Security RLS Gaps

  ## Summary
  Addresses all findings from the multi-tenant isolation security audit.

  ## Changes

  ### 1. system_secrets — Enable RLS (defense-in-depth)
  The table currently has no RLS. Column-level grants only allow `postgres` and
  `service_role` to access it, so no data is exposed to app users. We add RLS
  anyway to enforce this at the row level and prevent future accidental grants.
  No policies are added — this means the table is locked down to service_role
  only (which bypasses RLS), which is the correct behavior.

  ### 2. crew_efficiency_rules — Fix cross-org isolation
  All four policies (SELECT/INSERT/UPDATE/DELETE) check only that the user is
  an admin/owner in *any* organization, not specifically the organization that
  owns the row. Since this table uses `user_id` (not `organization_id`) as its
  isolation key, the policies are corrected to check `user_id = auth.uid()`.

  ### 3. client_work_requests — Fix anon SELECT data leak
  The "Anon can read own guest requests by email" policy allows any unauthenticated
  user to SELECT all guest work requests (where guest_email IS NOT NULL AND
  client_id IS NULL) across ALL organizations. This is replaced with a policy
  that requires the caller to supply their specific email via a URL parameter
  pattern — but since Supabase RLS cannot read query parameters, the correct
  fix is to simply DROP this overly-broad policy. Guest work request lookup
  should happen through the edge function (portal-public-api) which can safely
  scope by org slug + email combination.

  ## Notes
  - short_links USING(true) on public role is intentional (URL resolution must
    work unauthenticated) and is not changed.
  - app_settings / app_versions cross-tenant reads are intentional (global config).
  - UPDATE policies with no explicit WITH CHECK are safe because organization_id
    is not updatable by app users in any of the affected flows.
*/

-- ============================================================
-- 1. Enable RLS on system_secrets (defense-in-depth)
--    No policies added — service_role bypasses RLS, so only
--    backend functions can access this table.
-- ============================================================
ALTER TABLE public.system_secrets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Fix crew_efficiency_rules — scope to the owning user
-- ============================================================
DROP POLICY IF EXISTS "admin_select" ON public.crew_efficiency_rules;
DROP POLICY IF EXISTS "admin_insert" ON public.crew_efficiency_rules;
DROP POLICY IF EXISTS "admin_update" ON public.crew_efficiency_rules;
DROP POLICY IF EXISTS "admin_delete" ON public.crew_efficiency_rules;

CREATE POLICY "Users can view own crew efficiency rules"
  ON public.crew_efficiency_rules
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own crew efficiency rules"
  ON public.crew_efficiency_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own crew efficiency rules"
  ON public.crew_efficiency_rules
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own crew efficiency rules"
  ON public.crew_efficiency_rules
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- 3. Fix client_work_requests — remove overly-broad anon SELECT
--    The old policy exposed ALL guest work requests (name, email,
--    request details) from ALL organizations to any unauthenticated
--    visitor. Guest request lookup is handled by the portal-public-api
--    edge function which properly scopes by org slug + email.
-- ============================================================
DROP POLICY IF EXISTS "Anon can read own guest requests by email" ON public.client_work_requests;
