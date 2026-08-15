/*
  # Add Payment Terms to Invoices

  ## Overview
  Adds payment terms field to invoices table to support automatic due date calculation.

  ## Changes
  1. Modified Tables
    - `invoices`
      - Added `payment_terms` (text) - Payment terms (e.g., 'net_15', 'net_30', 'net_60', 'net_90', 'due_on_receipt', 'custom')
      - Stores the selected payment term for automatic due date calculation

  ## Notes
  - Payment terms enable automatic due date calculation when creating/editing invoices
  - Supported terms: Due on receipt, Net 15, Net 30, Net 60, Net 90, 3 months (90 days), Custom
  - Default is 'net_30' for backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_terms'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_terms text DEFAULT 'net_30';
  END IF;
END $$;