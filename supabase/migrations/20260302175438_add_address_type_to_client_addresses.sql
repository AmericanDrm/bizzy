/*
  # Add address_type to client_addresses

  1. Modified Tables
    - `client_addresses`
      - `address_type` (text, nullable) - Allows per-address commercial/residential designation
        - Values: 'residential', 'commercial', 'contractor'
        - When NULL, inherits from client-level client_type
        - Enables mixed-use clients with both commercial and residential addresses

  2. Notes
    - Existing addresses unaffected (column is nullable)
    - Client-level client_type remains the default fallback
    - Address-level type takes precedence when set
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'address_type'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN address_type text DEFAULT NULL;
  END IF;
END $$;
