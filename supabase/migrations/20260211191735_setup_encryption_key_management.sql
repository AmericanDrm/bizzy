/*
  # Set Up Encryption Key Management for Multi-Tenant Email

  1. Overview
    - Creates a secure table to store system encryption keys
    - Auto-generates encryption key on first access using pgcrypto
    - Provides helper function for edge functions to retrieve the key
    - Eliminates need for manual environment variable configuration

  2. New Tables
    - `system_secrets`: Stores system-wide secrets securely
      - `id` (uuid, primary key)
      - `name` (text, unique) - Secret identifier
      - `value` (text) - The secret value
      - `created_at` (timestamptz)

  3. Security
    - Table is only accessible via service_role (not through RLS)
    - No direct access from client applications
    - Function uses SECURITY DEFINER with restricted search_path

  4. Functions Created
    - get_email_encryption_key(): Returns the encryption key, creating if needed
*/

-- Create system secrets table (service_role only)
CREATE TABLE IF NOT EXISTS system_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Revoke all access from public and authenticated
REVOKE ALL ON system_secrets FROM PUBLIC;
REVOKE ALL ON system_secrets FROM authenticated;
REVOKE ALL ON system_secrets FROM anon;

-- Only service_role can access this table
GRANT SELECT, INSERT, UPDATE, DELETE ON system_secrets TO service_role;

-- Create function to get or create email encryption key
CREATE OR REPLACE FUNCTION get_email_encryption_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  -- Try to get existing key
  SELECT value INTO v_key
  FROM system_secrets
  WHERE name = 'email_encryption_key';

  -- If key doesn't exist, create one
  IF v_key IS NULL THEN
    -- Generate a secure random 32-byte key encoded as base64 using pgcrypto
    v_key := encode(extensions.gen_random_bytes(32), 'base64');
    
    -- Store the key
    INSERT INTO system_secrets (name, value, description)
    VALUES (
      'email_encryption_key',
      v_key,
      'Master encryption key for tenant email API keys - auto-generated'
    );
  END IF;

  RETURN v_key;
END;
$$;

-- Grant execute to service_role only (edge functions use service role)
REVOKE ALL ON FUNCTION get_email_encryption_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_email_encryption_key() TO service_role;

-- Initialize the key immediately so it's ready for use
SELECT get_email_encryption_key();