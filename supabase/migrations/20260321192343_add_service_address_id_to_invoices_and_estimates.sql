/*
  # Add service_address_id to invoices and estimates

  ## Summary
  Adds a `service_address_id` column to both `invoices` and `estimates` tables.
  This allows a single client (e.g., a homebuilder contact) to have different
  service/job site addresses per invoice or estimate, while billing always goes
  to the same client. Changing the address on an invoice/estimate will trigger
  the pane counter to reset to the address-specific count rather than the
  generic client-level count.

  ## Changes
  1. `invoices` table
     - New column: `service_address_id` (uuid, nullable, FK → client_addresses.id)
  2. `estimates` table
     - New column: `service_address_id` (uuid, nullable, FK → client_addresses.id)

  ## Security
  - No RLS changes needed; these columns inherit existing invoice/estimate policies.

  ## Notes
  - Nullable so existing records are unaffected.
  - ON DELETE SET NULL so deleting an address doesn't break invoices/estimates.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'service_address_id'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN service_address_id uuid REFERENCES client_addresses(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'service_address_id'
  ) THEN
    ALTER TABLE estimates
      ADD COLUMN service_address_id uuid REFERENCES client_addresses(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_service_address_id ON invoices(service_address_id);
CREATE INDEX IF NOT EXISTS idx_estimates_service_address_id ON estimates(service_address_id);
