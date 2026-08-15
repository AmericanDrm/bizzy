/*
  # Add memo column to invoices

  ## Summary
  Adds an optional memo field to invoices. When filled, the memo is displayed
  in place of the invoice number on the PDF and in email subjects/bodies.
  This allows businesses to add a descriptive reference (e.g., "Spring Cleaning - 123 Main St")
  instead of showing the system-generated invoice number.

  ## Changes
  - `invoices.memo` (text, nullable) - Optional memo/reference line shown instead of invoice number
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'memo'
  ) THEN
    ALTER TABLE invoices ADD COLUMN memo text;
  END IF;
END $$;
