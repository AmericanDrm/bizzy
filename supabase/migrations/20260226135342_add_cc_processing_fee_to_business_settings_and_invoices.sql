/*
  # Add Credit Card Processing Fee Support

  1. Modified Tables
    - `business_settings`
      - `cc_processing_fee_percent` (numeric, default 0) - The percentage Stripe charges the business (e.g. 2.9)
    - `invoices`
      - `cc_fee_percent` (numeric, default 0) - The CC processing fee percentage applied to this invoice
      - `cc_fee_amount` (numeric, default 0) - The calculated CC fee amount on this invoice

  2. Notes
    - Businesses can configure their Stripe processing fee percentage in settings
    - When creating an invoice, they can toggle on the CC fee to pass processing costs to the client
    - The fee is calculated on the subtotal + tax so the business receives the full invoiced amount after Stripe takes their cut
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'cc_processing_fee_percent'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN cc_processing_fee_percent numeric(5,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'cc_fee_percent'
  ) THEN
    ALTER TABLE invoices ADD COLUMN cc_fee_percent numeric(5,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'cc_fee_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN cc_fee_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;
