/*
  # Add service frequency to client addresses

  1. Modified Tables
    - `client_addresses`
      - `service_frequency` (text, nullable) - How often the address should be serviced.
        Values: 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'bi-annually', 'annually', 'custom'
      - `custom_frequency_days` (integer, nullable) - Number of days between services when frequency is 'custom'
      - `last_serviced_date` (date, nullable) - Date the address was last serviced, used for frequency calculations

  2. Constraints
    - service_frequency must be one of the allowed values
    - custom_frequency_days must be positive when provided

  3. Important Notes
    - Frequency is per-address so different locations for the same commercial client can have different schedules
    - The CommercialJobsPanel will use this to determine when addresses appear in the scheduling list
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'service_frequency'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN service_frequency text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'custom_frequency_days'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN custom_frequency_days integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'last_serviced_date'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN last_serviced_date date DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'client_addresses' AND constraint_name = 'chk_service_frequency'
  ) THEN
    ALTER TABLE client_addresses
      ADD CONSTRAINT chk_service_frequency
      CHECK (service_frequency IS NULL OR service_frequency IN ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'bi-annually', 'annually', 'custom'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'client_addresses' AND constraint_name = 'chk_custom_frequency_days'
  ) THEN
    ALTER TABLE client_addresses
      ADD CONSTRAINT chk_custom_frequency_days
      CHECK (custom_frequency_days IS NULL OR custom_frequency_days > 0);
  END IF;
END $$;
