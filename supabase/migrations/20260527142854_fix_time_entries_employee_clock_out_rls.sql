/*
  # Fix time_entries RLS to allow employees to clock themselves out

  ## Problem
  Migration 20260424205403 dropped the members_own_or_admin_update policy and replaced
  it with admins_update (managers/admins only). This silently blocks regular employees
  from updating their own time_entries rows when clocking out — the DB returns success
  with 0 rows updated, causing the UI to show "Clocked out" while the entry remains open.

  The members_clock_out_own policy was added directly to the DB without a migration file,
  so it may not exist in all environments.

  ## Fix
  Ensure members_clock_out_own exists and correctly allows employees to UPDATE their own
  time_entries rows (needed for clock_out, is_clocked_in, notes, etc.).
*/

-- Drop and re-create to ensure it's current
DROP POLICY IF EXISTS "members_clock_out_own" ON time_entries;

CREATE POLICY "members_clock_out_own"
  ON time_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
