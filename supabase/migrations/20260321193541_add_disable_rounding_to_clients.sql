/*
  # Add disable_rounding column to clients

  ## Summary
  Adds a `disable_rounding` boolean column to the `clients` table, allowing
  individual clients to be opted out of the organization-level price rounding
  feature. When enabled for a client, invoices and estimates for that client
  will always show the exact calculated total, ignoring any rounding rules
  configured in business settings.

  ## Changes
  1. `clients` table
     - New column: `disable_rounding` (boolean, default false)
       - false = use the org's rounding setting (default behavior)
       - true  = skip rounding for this client

  ## Notes
  - Nullable to boolean default false means no existing data is affected.
  - No RLS changes needed; inherits existing client policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'disable_rounding'
  ) THEN
    ALTER TABLE clients ADD COLUMN disable_rounding boolean NOT NULL DEFAULT false;
  END IF;
END $$;
