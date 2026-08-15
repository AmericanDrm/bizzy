/*
  # Add resend_master_api_key to tenant_email_settings

  ## Summary
  Adds a plain-text column to store the master Resend API key per organization.
  This allows the email-sending edge functions to read the key from the database
  rather than relying solely on the edge function secret, preventing null-key
  failures when secrets are rotated or not yet propagated.

  ## Changes
  - `tenant_email_settings`: new column `resend_master_api_key` (text, nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_email_settings' AND column_name = 'resend_master_api_key'
  ) THEN
    ALTER TABLE tenant_email_settings ADD COLUMN resend_master_api_key text;
  END IF;
END $$;
