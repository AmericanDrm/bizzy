/*
  # Portal Phase 2 Enhancements

  ## New Tables
  - `portal_messages` - In-portal messaging between clients and business
    - `id` (uuid, primary key)
    - `organization_id` (uuid, FK to organizations)
    - `client_id` (uuid, FK to clients)
    - `portal_account_id` (uuid, nullable FK to client_portal_accounts)
    - `sender_type` (text: 'client' | 'org')
    - `message` (text, the message content)
    - `is_read` (boolean, default false)
    - `created_at` (timestamptz)

  ## Modified Tables
  - `client_portal_settings` — adds:
    - `max_bookings_per_day` (integer, default 10)
    - `cancellation_hours_notice` (integer, default 24)
    - `require_deposit` (boolean, default false)
    - `deposit_amount` (numeric, default 0)
    - `deposit_type` (text: 'fixed' | 'percentage', default 'fixed')
    - `send_booking_confirmation_email` (boolean, default true)
  - `client_work_requests` — adds RLS policy so portal clients can cancel their own pending requests

  ## Security
  - RLS enabled on portal_messages
  - Portal clients (authenticated via client_portal_accounts) can view and send their own messages
  - Org members can view, send, and mark messages read for their org
  - Portal clients can update (cancel) their own pending work requests
*/

-- ============================================================
-- portal_messages table
-- ============================================================
CREATE TABLE IF NOT EXISTS portal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  portal_account_id uuid REFERENCES client_portal_accounts(id) ON DELETE SET NULL,
  sender_type text NOT NULL DEFAULT 'client' CHECK (sender_type IN ('client', 'org')),
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_messages_org_client ON portal_messages(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_created ON portal_messages(created_at);

ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;

-- Portal clients: view their own messages
CREATE POLICY "Portal clients can view their messages"
  ON portal_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_portal_accounts cpa
      WHERE cpa.user_id = auth.uid()
        AND cpa.client_id = portal_messages.client_id
        AND cpa.organization_id = portal_messages.organization_id
        AND cpa.is_active = true
    )
  );

-- Portal clients: send messages (only as 'client' sender)
CREATE POLICY "Portal clients can send messages"
  ON portal_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'client'
    AND EXISTS (
      SELECT 1 FROM client_portal_accounts cpa
      WHERE cpa.user_id = auth.uid()
        AND cpa.client_id = portal_messages.client_id
        AND cpa.organization_id = portal_messages.organization_id
        AND cpa.is_active = true
    )
  );

-- Portal clients: mark org messages as read
CREATE POLICY "Portal clients can mark messages read"
  ON portal_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_portal_accounts cpa
      WHERE cpa.user_id = auth.uid()
        AND cpa.client_id = portal_messages.client_id
        AND cpa.organization_id = portal_messages.organization_id
        AND cpa.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_portal_accounts cpa
      WHERE cpa.user_id = auth.uid()
        AND cpa.client_id = portal_messages.client_id
        AND cpa.organization_id = portal_messages.organization_id
        AND cpa.is_active = true
    )
  );

-- Org members: view all portal messages for their org
CREATE POLICY "Org members can view portal messages"
  ON portal_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = portal_messages.organization_id
    )
  );

-- Org members: send messages as 'org' sender
CREATE POLICY "Org members can send portal messages"
  ON portal_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'org'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = portal_messages.organization_id
    )
  );

-- Org members: update (mark read) portal messages
CREATE POLICY "Org members can update portal messages"
  ON portal_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = portal_messages.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = portal_messages.organization_id
    )
  );

-- ============================================================
-- client_portal_settings new columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_portal_settings' AND column_name = 'max_bookings_per_day') THEN
    ALTER TABLE client_portal_settings ADD COLUMN max_bookings_per_day integer DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_portal_settings' AND column_name = 'cancellation_hours_notice') THEN
    ALTER TABLE client_portal_settings ADD COLUMN cancellation_hours_notice integer DEFAULT 24;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_portal_settings' AND column_name = 'require_deposit') THEN
    ALTER TABLE client_portal_settings ADD COLUMN require_deposit boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_portal_settings' AND column_name = 'deposit_amount') THEN
    ALTER TABLE client_portal_settings ADD COLUMN deposit_amount numeric(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_portal_settings' AND column_name = 'deposit_type') THEN
    ALTER TABLE client_portal_settings ADD COLUMN deposit_type text DEFAULT 'fixed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_portal_settings' AND column_name = 'send_booking_confirmation_email') THEN
    ALTER TABLE client_portal_settings ADD COLUMN send_booking_confirmation_email boolean DEFAULT true;
  END IF;
END $$;

-- ============================================================
-- Allow portal clients to cancel their own pending work requests
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_work_requests'
      AND policyname = 'Portal clients can cancel their own requests'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Portal clients can cancel their own requests"
        ON client_work_requests FOR UPDATE
        TO authenticated
        USING (
          status IN ('pending')
          AND EXISTS (
            SELECT 1 FROM client_portal_accounts cpa
            WHERE cpa.user_id = auth.uid()
              AND cpa.client_id = client_work_requests.client_id
              AND cpa.organization_id = client_work_requests.organization_id
              AND cpa.is_active = true
          )
        )
        WITH CHECK (
          status = 'cancelled'
          AND EXISTS (
            SELECT 1 FROM client_portal_accounts cpa
            WHERE cpa.user_id = auth.uid()
              AND cpa.client_id = client_work_requests.client_id
              AND cpa.organization_id = client_work_requests.organization_id
              AND cpa.is_active = true
          )
        )
    $policy$;
  END IF;
END $$;
