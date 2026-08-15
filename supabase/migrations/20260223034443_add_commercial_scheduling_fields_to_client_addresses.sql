/*
  # Add commercial scheduling fields to client_addresses and clients

  ## Summary
  Adds per-address scheduling fields for commercial clients so each address
  can define its own service window, target week of month, and preferred day.
  Also adds client-level service window fields that serve as overarching
  defaults across all addresses.

  ## Changes

  ### client_addresses table (new columns)
    - `service_window_start` (time) - earliest service start time for this address
    - `service_window_end` (time) - latest service end time for this address
    - `target_week_of_month` (integer) - 1=First, 2=Second, 3=Third, 4=Fourth week
    - `preferred_day` (text) - preferred day of week (e.g. 'monday')
    - `use_client_service_window` (boolean) - when true, inherits from client-level window

  ### clients table (new columns)
    - `commercial_service_window_start` (time) - client-level default service window start
    - `commercial_service_window_end` (time) - client-level default service window end

  ## Notes
    - All columns are nullable so existing data is unaffected
    - The use_client_service_window flag defaults to true so new commercial
      addresses automatically inherit the client-level window
    - target_week_of_month is constrained to values 1-4
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'service_window_start'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN service_window_start time DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'service_window_end'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN service_window_end time DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'target_week_of_month'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN target_week_of_month integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'preferred_day'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN preferred_day text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'use_client_service_window'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN use_client_service_window boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'commercial_service_window_start'
  ) THEN
    ALTER TABLE clients ADD COLUMN commercial_service_window_start time DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'commercial_service_window_end'
  ) THEN
    ALTER TABLE clients ADD COLUMN commercial_service_window_end time DEFAULT NULL;
  END IF;
END $$;

ALTER TABLE client_addresses
  DROP CONSTRAINT IF EXISTS chk_target_week_of_month;

ALTER TABLE client_addresses
  ADD CONSTRAINT chk_target_week_of_month
  CHECK (target_week_of_month IS NULL OR (target_week_of_month >= 1 AND target_week_of_month <= 4));

ALTER TABLE client_addresses
  DROP CONSTRAINT IF EXISTS chk_preferred_day;

ALTER TABLE client_addresses
  ADD CONSTRAINT chk_preferred_day
  CHECK (preferred_day IS NULL OR preferred_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'));