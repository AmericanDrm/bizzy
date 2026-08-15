/*
  # Add Price Override to Clients Table

  ## Summary
  Adds client-level price override fields to the clients table, allowing a default
  flat-rate price to be set on a client profile that auto-fills into scheduling
  when no address-level override is active.

  ## Changes
  ### Modified Tables
  - `clients`
    - `price_override` (numeric, nullable) - Default flat-rate price for this client
    - `price_override_enabled` (boolean, default false) - Whether the client-level override is active

  ## Notes
  - Address-level overrides continue to take priority over the client-level override
  - The client-level override acts as a fallback when no address override is set
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'price_override'
  ) THEN
    ALTER TABLE clients ADD COLUMN price_override numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'price_override_enabled'
  ) THEN
    ALTER TABLE clients ADD COLUMN price_override_enabled boolean DEFAULT false;
  END IF;
END $$;
