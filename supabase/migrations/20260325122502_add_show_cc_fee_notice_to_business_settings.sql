/*
  # Add CC Fee Notice Setting to Business Settings

  ## Summary
  Adds a boolean column to control whether clients see a credit card processing fee disclosure
  on invoices, emails, and SMS messages.

  ## Changes
  ### Modified Tables
  - `business_settings`
    - `show_cc_fee_notice` (boolean, DEFAULT false) - When true, clients will see a prominent
      notice that a CC processing fee applies if they pay by card. When false, the fee is treated
      as a silent business expense with no client-facing disclosure.

  ## Notes
  - Defaults to false so existing behavior is preserved for all current users
  - Only relevant when cc_processing_fee_percent > 0 is also configured
  - Works in conjunction with the existing includeCcFee toggle on individual invoices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'show_cc_fee_notice'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN show_cc_fee_notice boolean DEFAULT false;
  END IF;
END $$;
