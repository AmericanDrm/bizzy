/*
  # Add Caller ID Infrastructure

  1. New Tables
    - `call_log`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `client_id` (uuid, references clients)
      - `phone_number` (text) - the incoming phone number
      - `call_timestamp` (timestamptz) - when the call occurred
      - `action_taken` (text) - what action user took (scheduled, dismissed, etc.)
      - `created_at` (timestamptz)

    - `caller_id_settings`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `user_id` (uuid, references auth.users)
      - `enabled` (boolean) - whether caller ID is enabled
      - `show_post_call_card` (boolean) - whether to show the quick-action card after calls
      - `auto_prefill_schedule` (boolean) - auto-fill schedule modal with client data
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. New Indexes
    - Index on `clients.phone` for fast phone number lookups
    - Index on `call_log.organization_id`
    - Index on `call_log.client_id`
    - Index on `call_log.phone_number`

  3. Security
    - Enable RLS on both new tables
    - Policies scoped to authenticated users within their organization
*/

-- Index on clients.phone for fast caller ID lookups
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone);

-- Index on secondary contact phone
CREATE INDEX IF NOT EXISTS idx_clients_secondary_phone ON clients (secondary_contact_phone)
  WHERE secondary_contact_phone IS NOT NULL AND secondary_contact_phone != '';

-- Call log table
CREATE TABLE IF NOT EXISTS call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  phone_number text NOT NULL DEFAULT '',
  call_timestamp timestamptz NOT NULL DEFAULT now(),
  action_taken text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE call_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_call_log_org ON call_log (organization_id);
CREATE INDEX IF NOT EXISTS idx_call_log_client ON call_log (client_id);
CREATE INDEX IF NOT EXISTS idx_call_log_phone ON call_log (phone_number);
CREATE INDEX IF NOT EXISTS idx_call_log_timestamp ON call_log (call_timestamp DESC);

CREATE POLICY "Users can view call logs in their org"
  ON call_log FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert call logs in their org"
  ON call_log FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update call logs in their org"
  ON call_log FOR UPDATE
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

CREATE POLICY "Users can delete call logs in their org"
  ON call_log FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Caller ID settings table
CREATE TABLE IF NOT EXISTS caller_id_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  show_post_call_card boolean NOT NULL DEFAULT true,
  auto_prefill_schedule boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE caller_id_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_caller_id_settings_user ON caller_id_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_caller_id_settings_org ON caller_id_settings (organization_id);

CREATE POLICY "Users can view their own caller ID settings"
  ON caller_id_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own caller ID settings"
  ON caller_id_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own caller ID settings"
  ON caller_id_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own caller ID settings"
  ON caller_id_settings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
