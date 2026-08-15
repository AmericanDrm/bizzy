/*
  # Add Access Code Fields to Client Addresses

  ## Summary
  Adds two new columns to the `client_addresses` table to store property access codes
  (e.g., garage codes, gate codes, door codes) for each address.

  ## New Columns
  - `access_code_type` (text) — The type of access code. One of: 'garage', 'gate', 'door', 'custom'. Defaults to null.
  - `access_code` (text) — The actual code value, max 10 characters. Defaults to null.

  ## Notes
  - Both columns are nullable; not every address will have an access code.
  - No RLS changes needed; these columns are part of existing `client_addresses` rows
    and are governed by the existing RLS policies on that table.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'access_code_type'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN access_code_type text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'access_code'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN access_code text DEFAULT NULL;
  END IF;
END $$;
