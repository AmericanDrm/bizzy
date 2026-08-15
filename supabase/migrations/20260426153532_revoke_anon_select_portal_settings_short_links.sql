/*
  # Revoke remaining anon SELECT grants to clear pg_graphql introspection warnings

  ## Summary
  Two tables still had anon SELECT grants from the previous migration:
  - public.client_portal_settings
  - public.short_links

  Both are accessed exclusively through Edge Functions that use the
  SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely. The anon SELECT
  grants are not needed for any app flow:

  - short_links: resolved by the `pdf-redirect` Edge Function (service role)
  - client_portal_settings: read by the `portal-public-api` Edge Function (service role)

  Revoking these grants removes the tables from pg_graphql introspection for
  the anon role without breaking any functionality.

  Note: The `client_work_requests` INSERT and `email_unsubscribes` INSERT grants
  for anon are retained since those are write-only and do not expose data via
  introspection in a meaningful way (introspection exposes schema, not data,
  and write-only tables reveal no sensitive row content).
*/

REVOKE SELECT ON public.client_portal_settings FROM anon;
REVOKE SELECT ON public.short_links FROM anon;
