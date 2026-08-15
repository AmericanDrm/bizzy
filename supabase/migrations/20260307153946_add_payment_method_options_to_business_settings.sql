/*
  # Add Payment Method Options to Business Settings

  1. Modified Tables
    - `business_settings`
      - `venmo_username` (text, nullable) - Venmo handle for receiving payments
      - `cashapp_username` (text, nullable) - Cash App cashtag for receiving payments
      - `zelle_email` (text, nullable) - Email address for Zelle payments
      - `zelle_phone` (text, nullable) - Phone number for Zelle payments
      - `check_payable_to` (text, nullable) - Name to make checks payable to
      - `check_mailing_address` (text, nullable) - Mailing address for check payments

  2. Notes
    - All fields are optional so businesses only configure the methods they accept
    - Only configured methods will appear on invoice emails and PDFs
    - No security changes needed as business_settings RLS already covers these columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'venmo_username'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN venmo_username text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'cashapp_username'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN cashapp_username text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'zelle_email'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN zelle_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'zelle_phone'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN zelle_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'check_payable_to'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN check_payable_to text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'check_mailing_address'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN check_mailing_address text;
  END IF;
END $$;
