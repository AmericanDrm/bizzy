/*
  # Add Price Override to Client Addresses

  ## Summary
  Adds two new columns to the `client_addresses` table that allow a fixed flat-rate
  price to be stored per address. When enabled, this price overrides the automatically
  computed total (from pane counts × job type rates) in scheduled jobs, work orders,
  and invoices.

  ## New Columns
  - `price_override` (numeric) — The flat-rate price for this address. Defaults to NULL.
  - `price_override_enabled` (boolean) — Whether the override is active. Defaults to false.

  ## Notes
  - Both columns are nullable/optional. If `price_override_enabled` is false or NULL,
    the system falls back to the automatic pane-count-based calculation.
  - No RLS changes needed; governed by existing `client_addresses` policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'price_override'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN price_override numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'price_override_enabled'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN price_override_enabled boolean DEFAULT false;
  END IF;
END $$;
