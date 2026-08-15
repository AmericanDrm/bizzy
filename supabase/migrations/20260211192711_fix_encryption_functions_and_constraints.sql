/*
  # Fix Encryption Functions and Add Missing Constraints

  1. Fixes
    - Updates encrypt_api_key function to use extensions.pgp_sym_encrypt
    - Updates decrypt_api_key function to use extensions.pgp_sym_decrypt
    - Adds unique constraint on business_settings.organization_id for upsert support

  2. Security
    - Functions remain SECURITY DEFINER with restricted search_path
*/

-- Fix encrypt_api_key function to use correct schema for pgcrypto
CREATE OR REPLACE FUNCTION encrypt_api_key(plain_key text, encryption_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(
    extensions.pgp_sym_encrypt(plain_key, encryption_secret),
    'base64'
  );
END;
$$;

-- Fix decrypt_api_key function to use correct schema for pgcrypto
CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_key text, encryption_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN extensions.pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    encryption_secret
  );
END;
$$;

-- Add unique constraint on business_settings.organization_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'business_settings' 
    AND constraint_type = 'UNIQUE'
    AND constraint_name = 'business_settings_organization_id_key'
  ) THEN
    ALTER TABLE business_settings ADD CONSTRAINT business_settings_organization_id_key UNIQUE (organization_id);
  END IF;
END $$;