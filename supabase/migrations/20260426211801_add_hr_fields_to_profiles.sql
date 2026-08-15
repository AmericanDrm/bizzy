/*
  # Add HR fields to profiles table

  ## Summary
  Adds employment and compensation fields to the profiles table so admins/owners
  can configure payroll cost information per team member.

  ## New Columns on `profiles`
  - `employment_type` (text) — 'full_time', 'part_time', 'contractor', 'seasonal'
  - `pay_period` (text) — 'weekly', 'biweekly', 'semimonthly', 'monthly'
  - `pay_rate_type` (text) — 'hourly', 'salary'
  - `annual_salary` (numeric 10,2) — annual salary amount if pay_rate_type = 'salary'
  - `overtime_rate_multiplier` (numeric 4,2) — e.g. 1.5 for time-and-a-half (default 1.5)
  - `hr_notes` (text) — private admin notes on the employee

  ## Notes
  - The existing `hourly_rate` column already exists; these columns complement it
  - All new columns are nullable with sensible defaults
  - No RLS changes needed; profiles table already has appropriate policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'employment_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN employment_type text DEFAULT 'full_time';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'pay_period'
  ) THEN
    ALTER TABLE profiles ADD COLUMN pay_period text DEFAULT 'biweekly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'pay_rate_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN pay_rate_type text DEFAULT 'hourly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'annual_salary'
  ) THEN
    ALTER TABLE profiles ADD COLUMN annual_salary numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'overtime_rate_multiplier'
  ) THEN
    ALTER TABLE profiles ADD COLUMN overtime_rate_multiplier numeric(4,2) DEFAULT 1.5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'hr_notes'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hr_notes text DEFAULT '';
  END IF;
END $$;
