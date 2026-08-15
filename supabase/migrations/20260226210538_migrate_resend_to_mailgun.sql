/*
  # Migrate email provider from Resend to Mailgun

  ## Summary
  Replaces all Resend-specific column names and references in the tenant_email_settings
  table with Mailgun equivalents. The architecture remains the same: one API key per
  organization (master key stored as plain text, per-domain key stored encrypted).

  ## Changes to tenant_email_settings
  - Rename `resend_api_key_encrypted` → `mailgun_api_key_encrypted`
  - Rename `resend_key_id` → `mailgun_domain_id` (was already functionally a domain ID)
  - Rename `resend_master_api_key` → `mailgun_master_api_key`
  - Update default value of `sending_domain` comment (no structural change)

  ## Notes
  - Existing data is preserved; only column names change
  - All edge functions must be redeployed after this migration
  - The `domain_id` column already exists and maps to Mailgun domain name
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_email_settings' AND column_name = 'resend_api_key_encrypted'
  ) THEN
    ALTER TABLE tenant_email_settings
      RENAME COLUMN resend_api_key_encrypted TO mailgun_api_key_encrypted;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_email_settings' AND column_name = 'resend_key_id'
  ) THEN
    ALTER TABLE tenant_email_settings
      RENAME COLUMN resend_key_id TO mailgun_key_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_email_settings' AND column_name = 'resend_master_api_key'
  ) THEN
    ALTER TABLE tenant_email_settings
      RENAME COLUMN resend_master_api_key TO mailgun_master_api_key;
  END IF;
END $$;
