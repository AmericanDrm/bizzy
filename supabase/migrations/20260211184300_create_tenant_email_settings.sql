/*
  # Create Tenant Email Settings Table

  1. New Tables
    - `tenant_email_settings`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations, unique)
      - `resend_api_key_encrypted` (text, encrypted API key)
      - `resend_key_id` (text, Resend's key ID for management)
      - `sending_domain` (text, the domain used for sending)
      - `domain_id` (text, Resend's domain ID)
      - `domain_status` (text, verification status)
      - `domain_records` (jsonb, DNS records for verification)
      - `custom_from_name` (text, custom sender name)
      - `custom_from_email` (text, custom sender email)
      - `is_active` (boolean, whether email sending is enabled)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Only org admins/owners can view/manage their settings
    - API keys are encrypted and never exposed to frontend

  3. Notes
    - Uses pgcrypto for encryption
    - Encryption key is stored as Supabase secret
    - API keys are only decrypted server-side in edge functions
*/

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create tenant email settings table
CREATE TABLE IF NOT EXISTS tenant_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resend_api_key_encrypted text,
  resend_key_id text,
  sending_domain text DEFAULT 'resend.dev',
  domain_id text,
  domain_status text DEFAULT 'pending',
  domain_records jsonb,
  custom_from_name text,
  custom_from_email text,
  is_active boolean DEFAULT false,
  setup_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT tenant_email_settings_organization_id_key UNIQUE (organization_id)
);

-- Create index for organization lookups
CREATE INDEX IF NOT EXISTS idx_tenant_email_settings_org 
  ON tenant_email_settings(organization_id);

-- Enable RLS
ALTER TABLE tenant_email_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only org owners/admins can manage email settings
CREATE POLICY "Org owners can view email settings"
  ON tenant_email_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = tenant_email_settings.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners can insert email settings"
  ON tenant_email_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = tenant_email_settings.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners can update email settings"
  ON tenant_email_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = tenant_email_settings.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = tenant_email_settings.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners can delete email settings"
  ON tenant_email_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = tenant_email_settings.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_email_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS tenant_email_settings_updated_at ON tenant_email_settings;
CREATE TRIGGER tenant_email_settings_updated_at
  BEFORE UPDATE ON tenant_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_email_settings_updated_at();

-- Create a secure function to encrypt API keys (only callable by service role)
CREATE OR REPLACE FUNCTION encrypt_api_key(plain_key text, encryption_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(plain_key, encryption_secret),
    'base64'
  );
END;
$$;

-- Create a secure function to decrypt API keys (only callable by service role)
CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_key text, encryption_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    encryption_secret
  );
END;
$$;

-- Revoke execute from public, only service role can use these
REVOKE EXECUTE ON FUNCTION encrypt_api_key(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION decrypt_api_key(text, text) FROM PUBLIC;