/*
  # SMS System Tables for Multi-Tenant Architecture

  1. New Tables
    - `tenant_sms_settings`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `twilio_phone_number` (text) - The purchased Twilio phone number
      - `twilio_phone_number_sid` (text) - Twilio phone number SID
      - `a2p_brand_id` (text) - A2P 10DLC brand registration ID
      - `a2p_brand_status` (text) - Brand registration status
      - `a2p_campaign_id` (text) - A2P 10DLC campaign registration ID
      - `a2p_campaign_status` (text) - Campaign registration status
      - `company_name` (text) - For A2P registration
      - `company_ein` (text) - Encrypted EIN for A2P registration
      - `company_website` (text) - Company website for A2P
      - `use_case_description` (text) - SMS use case for A2P
      - `opt_in_keywords` (text[]) - Keywords for opt-in (default: START, YES)
      - `opt_out_keywords` (text[]) - Keywords for opt-out (default: STOP, UNSUBSCRIBE)
      - `help_keywords` (text[]) - Keywords for help (default: HELP, INFO)
      - `help_response` (text) - Auto-reply for HELP
      - `opt_out_response` (text) - Auto-reply for STOP
      - `opt_in_response` (text) - Auto-reply for START
      - `is_active` (boolean) - Whether SMS is active for this tenant
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sms_messages`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `from_number` (text) - Sender phone number
      - `to_number` (text) - Recipient phone number
      - `body` (text) - Message content
      - `direction` (text) - 'inbound' or 'outbound'
      - `status` (text) - Message status (queued, sent, delivered, failed, received)
      - `twilio_message_sid` (text) - Twilio message SID
      - `error_code` (text) - Error code if failed
      - `error_message` (text) - Error message if failed
      - `client_id` (uuid, optional) - Link to client if known
      - `segments` (integer) - Number of SMS segments
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sms_opt_status`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `phone_number` (text) - The phone number
      - `status` (text) - 'opted_in', 'opted_out', 'pending'
      - `opted_out_at` (timestamptz)
      - `opted_in_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Policies for organization-based access
    - Only owners/admins can modify SMS settings
    - All members can view messages

  3. Indexes
    - Index on organization_id for all tables
    - Index on phone numbers for lookup
    - Index on created_at for message ordering
*/

-- Tenant SMS Settings Table
CREATE TABLE IF NOT EXISTS tenant_sms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  twilio_phone_number text,
  twilio_phone_number_sid text,
  a2p_brand_id text,
  a2p_brand_status text DEFAULT 'unregistered',
  a2p_campaign_id text,
  a2p_campaign_status text DEFAULT 'unregistered',
  company_name text,
  company_ein_encrypted text,
  company_website text,
  use_case_description text,
  opt_in_keywords text[] DEFAULT ARRAY['START', 'YES', 'UNSTOP']::text[],
  opt_out_keywords text[] DEFAULT ARRAY['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']::text[],
  help_keywords text[] DEFAULT ARRAY['HELP', 'INFO']::text[],
  help_response text DEFAULT 'Reply STOP to unsubscribe. Reply START to resubscribe. For support, contact us at our main number.',
  opt_out_response text DEFAULT 'You have been unsubscribed and will no longer receive messages from us. Reply START to resubscribe.',
  opt_in_response text DEFAULT 'You have been resubscribed to receive messages from us. Reply STOP to unsubscribe.',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

-- SMS Messages Table
CREATE TABLE IF NOT EXISTS sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'received')),
  twilio_message_sid text,
  error_code text,
  error_message text,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  segments integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- SMS Opt Status Table (for TCPA compliance)
CREATE TABLE IF NOT EXISTS sms_opt_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('opted_in', 'opted_out', 'pending')),
  opted_out_at timestamptz,
  opted_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, phone_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_sms_settings_org ON tenant_sms_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenant_sms_settings_phone ON tenant_sms_settings(twilio_phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_org ON sms_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_from ON sms_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to ON sms_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(organization_id, direction);
CREATE INDEX IF NOT EXISTS idx_sms_messages_client ON sms_messages(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_opt_status_org ON sms_opt_status(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_opt_status_phone ON sms_opt_status(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_opt_status_org_phone ON sms_opt_status(organization_id, phone_number);

-- Enable RLS
ALTER TABLE tenant_sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_sms_settings
CREATE POLICY "Users can view their org SMS settings"
  ON tenant_sms_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can insert SMS settings"
  ON tenant_sms_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update SMS settings"
  ON tenant_sms_settings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can delete SMS settings"
  ON tenant_sms_settings FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.role = 'owner'
    )
  );

-- RLS Policies for sms_messages
CREATE POLICY "Users can view their org SMS messages"
  ON sms_messages FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert SMS messages for their org"
  ON sms_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update SMS messages for their org"
  ON sms_messages FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

-- RLS Policies for sms_opt_status
CREATE POLICY "Users can view their org opt status"
  ON sms_opt_status FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert opt status for their org"
  ON sms_opt_status FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update opt status for their org"
  ON sms_opt_status FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

-- Updated at trigger function (reuse if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_tenant_sms_settings_updated_at ON tenant_sms_settings;
CREATE TRIGGER update_tenant_sms_settings_updated_at
  BEFORE UPDATE ON tenant_sms_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_opt_status_updated_at ON sms_opt_status;
CREATE TRIGGER update_sms_opt_status_updated_at
  BEFORE UPDATE ON sms_opt_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to encrypt EIN (similar pattern to API keys)
CREATE OR REPLACE FUNCTION encrypt_ein(ein text, org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  SELECT key INTO encryption_key
  FROM encryption_keys
  WHERE key_type = 'api_key'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'No encryption key found';
  END IF;
  
  RETURN encode(
    encrypt(
      ein::bytea,
      encryption_key::bytea,
      'aes'
    ),
    'base64'
  );
END;
$$;

-- Function to decrypt EIN
CREATE OR REPLACE FUNCTION decrypt_ein(encrypted_ein text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  SELECT key INTO encryption_key
  FROM encryption_keys
  WHERE key_type = 'api_key'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'No encryption key found';
  END IF;
  
  RETURN convert_from(
    decrypt(
      decode(encrypted_ein, 'base64'),
      encryption_key::bytea,
      'aes'
    ),
    'UTF8'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION encrypt_ein(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_ein(text) TO authenticated;