/*
  # Add hourly_rate to profiles

  ## Summary
  Adds an optional hourly pay rate to user profiles so the TimeClock page
  can display an "Est. Pay" figure in weekly/monthly report accordions.

  ## Changes
  - `profiles`: new column `hourly_rate` (numeric, nullable, default null)
    - Stores the user's hourly wage for payroll estimation
    - Null means "not configured" — UI hides Est. Pay in that case

  ## Security
  No RLS changes needed; existing profile policies already cover this column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hourly_rate numeric(10,2) DEFAULT NULL;
  END IF;
END $$;
