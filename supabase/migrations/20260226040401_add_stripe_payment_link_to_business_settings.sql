/*
  # Add Stripe Payment Link to Business Settings

  1. Modified Tables
    - `business_settings`
      - `stripe_payment_link` (text, nullable) - URL for Stripe payment link that appears on invoices

  2. Purpose
    - Allows businesses to configure a Stripe payment link
    - The link is included in invoice emails so clients can pay online
    - Each organization can set their own payment link

  3. Important Notes
    - No data loss - only adding a new nullable column
    - Existing rows will have NULL for this column by default
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'stripe_payment_link'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN stripe_payment_link text;
  END IF;
END $$;
