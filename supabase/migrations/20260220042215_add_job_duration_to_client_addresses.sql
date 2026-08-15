/*
  # Add job duration per address

  ## Summary
  Adds a `typical_job_duration` column to `client_addresses` so each
  address can have its own default job duration (in minutes), independent
  of the client-level default.

  ## Changes
  - `client_addresses.typical_job_duration` — nullable integer (minutes).
    NULL means "use the client-level default".
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'typical_job_duration'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN typical_job_duration integer DEFAULT NULL;
  END IF;
END $$;
