/*
  # Add default tax rate and business state to business_settings

  1. Modified Tables
    - `business_settings`
      - `business_state` (text) - US state code for automatic tax rate lookup
      - `default_tax_rate` (numeric) - Default tax rate percentage to auto-populate on invoices/estimates

  2. Notes
    - These fields allow automatic tax rate population when creating new invoices and estimates
    - The business_state stores a 2-letter US state code (e.g., 'TX', 'CA')
    - Users can still manually override tax rates on individual invoices/estimates
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'business_state'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN business_state text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'default_tax_rate'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN default_tax_rate numeric(5,2) DEFAULT 0;
  END IF;
END $$;
