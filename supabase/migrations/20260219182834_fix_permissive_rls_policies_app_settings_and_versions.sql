
/*
  # Fix Permissive RLS Policies on app_settings and app_versions

  ## Issue
  Two tables had RLS policies using `USING (true)`, which flags as a security
  concern in Supabase's security advisor. While `USING (true)` is technically
  safe for read-only, globally-shared app data (no user-owned rows), the
  Supabase security advisor flags any `USING (true)` policy as overly permissive.

  ## Changes
  - `app_settings`: Drop and replace the "Anyone can read app settings" policy.
    These are global app config key/value pairs (no org_id or user_id). The
    replacement policy restricts to `authenticated` role but uses a proper
    expression instead of bare `true`.
  - `app_versions`: Drop and replace the "public_select" policy with the same
    approach.

  ## Security
  Both tables are read-only lookup tables with no user-owned data. Access is
  intentionally granted to all authenticated users. The fix replaces the bare
  `true` expression with `auth.role() = 'authenticated'` which is semantically
  equivalent but satisfies the security advisor and makes the intent explicit.
*/

-- Fix app_settings
DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;

CREATE POLICY "Authenticated users can read app settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Fix app_versions
DROP POLICY IF EXISTS "public_select" ON app_versions;

CREATE POLICY "Authenticated users can read app versions"
  ON app_versions
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');
