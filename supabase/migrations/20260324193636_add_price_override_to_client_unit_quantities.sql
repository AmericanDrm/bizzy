/*
  # Add price override to client unit quantities

  ## Summary
  Adds a per-service-type (job type) price override to the client_unit_quantities table.
  This allows setting a flat rate price for a specific service type at a specific client address,
  which persists and auto-fills when invoicing that client for that service type.

  ## Changes

  ### Modified Tables
  - `client_unit_quantities`
    - `price_override` (numeric, nullable) - Custom flat rate price for this service type at this address
    - `price_override_enabled` (boolean, default false) - Whether the price override is active

  ## Notes
  - Per-job-type price overrides take priority over the address-level flat rate override
  - When invoicing a client, if a price_override_enabled entry exists for the selected job type
    and address, it will be used as the unit_price for that line item
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_quantities' AND column_name = 'price_override'
  ) THEN
    ALTER TABLE client_unit_quantities ADD COLUMN price_override numeric DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_unit_quantities' AND column_name = 'price_override_enabled'
  ) THEN
    ALTER TABLE client_unit_quantities ADD COLUMN price_override_enabled boolean DEFAULT false;
  END IF;
END $$;
