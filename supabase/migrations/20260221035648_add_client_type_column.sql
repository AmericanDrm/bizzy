/*
  # Add client_type column to clients table

  ## Summary
  Adds a `client_type` column to the `clients` table to support filtering clients
  by type: residential, commercial, or contractor.

  ## Changes
  - `clients` table: new nullable `client_type` text column (defaults to null)

  ## Notes
  - Nullable so existing clients are unaffected
  - Values: 'residential', 'commercial', 'contractor'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'client_type'
  ) THEN
    ALTER TABLE clients ADD COLUMN client_type text DEFAULT NULL;
  END IF;
END $$;
