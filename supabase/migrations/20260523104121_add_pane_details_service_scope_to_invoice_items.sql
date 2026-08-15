/*
  # Add pane_details and service_scope to invoice_items

  ## Summary
  Adds two columns to the invoice_items table that already exist on estimate_items
  but were never added to invoices. Without these, pane breakdown data is lost when
  an invoice is saved and reloaded, causing the system to fall back to the client's
  current profile data instead of the values from the time of invoice creation.

  ## Changes
  - `invoice_items.pane_details` (jsonb, nullable) — stores per-pane-type breakdown
  - `invoice_items.service_scope` (text, nullable) — stores full_service / exterior_only / interior_only
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'pane_details'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN pane_details jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'service_scope'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN service_scope text DEFAULT NULL;
  END IF;
END $$;
