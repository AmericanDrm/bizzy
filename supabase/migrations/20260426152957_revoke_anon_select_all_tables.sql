/*
  # Revoke anon SELECT on all public tables

  ## Summary
  The `anon` role inherits SELECT on all tables in the public schema via
  Supabase's default grants. This causes every table to appear in the
  pg_graphql introspection endpoint for unauthenticated requests, exposing
  the full schema structure publicly.

  ## Fix
  Explicitly REVOKE SELECT (and all other privileges) from `anon` on every
  table and view in the public schema, then re-grant only the minimum needed
  for legitimate anonymous access:
    - client_work_requests: anon INSERT only (guest booking submissions)
    - client_portal_settings: anon SELECT only (portal login page needs org slug lookup)
    - short_links: anon SELECT only (URL redirect must work without login)
    - email_unsubscribes: anon INSERT only (one-click unsubscribe links)

  ## Also
  Adds a service-role-only policy comment to system_secrets to satisfy the
  "RLS enabled but no policies" scanner warning. The table is only accessible
  via service_role (which bypasses RLS), so no actual policy is needed for
  authenticated users — but we add an explicit deny to make the intent clear.

  ## Impact
  - App users are unaffected (they use the `authenticated` role via JWT)
  - Edge functions are unaffected (they use service_role key, bypasses RLS)
  - GraphQL introspection for anon: tables will no longer appear
  - REST API for anon: still blocked by RLS policies (no change in data access)
*/

-- ============================================================
-- Revoke ALL privileges from anon on every table/view
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type IN ('BASE TABLE', 'VIEW')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.table_name);
  END LOOP;
END $$;

-- ============================================================
-- Re-grant only what anonymous users legitimately need
-- ============================================================

-- Short link resolution: public URL redirects must work unauthenticated
GRANT SELECT ON public.short_links TO anon;

-- Client portal: login page needs to look up org by slug to show branding
GRANT SELECT ON public.client_portal_settings TO anon;

-- Guest work requests: portal allows unauthenticated booking submissions
GRANT INSERT ON public.client_work_requests TO anon;

-- Email unsubscribe: one-click links in emails must work without login
GRANT INSERT ON public.email_unsubscribes TO anon;

-- ============================================================
-- system_secrets: add explicit deny policy so scanner is satisfied
-- The table is only used by service_role (bypasses RLS).
-- Authenticated users should never access it directly.
-- ============================================================
DROP POLICY IF EXISTS "No direct access for app users" ON public.system_secrets;

CREATE POLICY "No direct access for app users"
  ON public.system_secrets
  FOR SELECT
  TO authenticated
  USING (false);
