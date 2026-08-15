/*
  # Revoke Anon Role Access to GraphQL Introspection

  ## Summary
  Removes the `anon` role's ability to access the `graphql_public` schema, which
  powers the public `/graphql/v1` introspection endpoint.

  ## Problem
  The `anon` role (used for unauthenticated requests) has USAGE on the
  `graphql_public` schema. This means anyone can query the GraphQL introspection
  endpoint without logging in and see the names, columns, and relationships of
  every table in the public schema — including sensitive tables like `clients`,
  `invoices`, `profiles`, `business_settings`, `tenant_sms_settings`, etc.

  ## Fix
  Revoke USAGE on `graphql_public` from `anon`. Authenticated users (role
  `authenticated`) retain full GraphQL access. The Supabase JS client used by
  the app always authenticates via the `authenticated` role, so this has no
  impact on app functionality.

  ## Security Impact
  - Unauthenticated GraphQL introspection: BLOCKED
  - App functionality (uses PostgREST REST API, not GraphQL): UNAFFECTED
  - Authenticated GraphQL access: UNAFFECTED
*/

REVOKE USAGE ON SCHEMA graphql_public FROM anon;
