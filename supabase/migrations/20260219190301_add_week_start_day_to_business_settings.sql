/*
  # Add week_start_day to business_settings

  ## Summary
  Adds a `week_start_day` column to the `business_settings` table so organizations
  can define which day their work week begins. This drives the "This Week" filter
  on the Time Clock screen.

  ## Changes
  - `business_settings`
    - Added `week_start_day` (integer, 0–6): 0 = Sunday, 1 = Monday, ... 6 = Saturday
    - Defaults to 0 (Sunday) to preserve existing behavior

  ## Notes
  - Safe: uses IF NOT EXISTS pattern via DO block
  - No data is destroyed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'week_start_day'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN week_start_day integer NOT NULL DEFAULT 0;
  END IF;
END $$;
