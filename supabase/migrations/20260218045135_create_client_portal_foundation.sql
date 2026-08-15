/*
  # Client Portal Foundation

  ## Overview
  Establishes the full data architecture for the Client Hub (Client Portal) feature,
  similar to Jobber's client portal. Designed to reduce admin workload by letting
  clients self-serve their invoices, estimates, and schedule.

  ## New Tables

  ### client_portal_settings
  One row per organization. Admins toggle portal on/off and configure global
  booking availability windows.
  - `organization_id` - FK to organizations (unique - one settings row per org)
  - `is_enabled` - master on/off switch for the portal
  - `portal_title` - Custom name shown on the portal login page
  - `welcome_message` - Greeting shown to visitors
  - `booking_start_time` / `booking_end_time` - Time window clients can book
  - `available_days` - Array of day names (e.g. ['Monday','Tuesday',...])
  - `allow_guest_booking` - Whether unknown visitors can submit booking requests
  - `require_booking_approval` - Whether bookings need admin approval
  - `primary_color` - Accent color for the portal branding

  ### client_portal_accounts
  Links a Supabase Auth user to a specific client record and organization.
  This is what gives a client their "Client role" access.
  - `client_id` - FK to clients (each client can have at most one portal account per org)
  - `organization_id` - FK to organizations
  - `user_id` - FK to auth.users (the Supabase Auth account for this portal client)
  - `is_active` - Allows disabling access without deleting the record

  ## Modified Tables

  ### clients
  - `is_portal_enabled` (boolean, default false) - Per-client toggle for portal access
  - `portal_email` (text, nullable) - Email used for portal login identity lookup

  ## New RLS Helper Functions
  - `get_portal_client_id()` - Returns the client_id for the current auth user if they
    are a portal client, NULL otherwise. Used in RLS policies.
  - `get_portal_org_id()` - Returns the organization_id for the current portal client.
  - `is_portal_client_for(check_client_id)` - Boolean check if current user is the
    portal account holder for a specific client.

  ## Security Changes
  - RLS enabled on both new tables
  - Portal clients get SELECT-only access to their own invoices, estimates,
    and schedule_events via additive policies on those existing tables
  - Portal clients can view their own client profile row
  - `client_portal_settings` is publicly readable (anon) when `is_enabled = true`,
    enabling the unauthenticated portal landing page
  - All helper functions use SECURITY DEFINER with search_path locked to prevent
    privilege escalation
*/

-- ============================================================
-- 1. Add portal columns to the clients table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'is_portal_enabled'
  ) THEN
    ALTER TABLE clients ADD COLUMN is_portal_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'portal_email'
  ) THEN
    ALTER TABLE clients ADD COLUMN portal_email text;
  END IF;
END $$;

-- ============================================================
-- 2. client_portal_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS client_portal_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  is_enabled              boolean DEFAULT false,
  portal_title            text DEFAULT 'Client Hub',
  welcome_message         text DEFAULT 'Welcome! Sign in to view your invoices, estimates, and upcoming appointments.',
  booking_start_time      time DEFAULT '09:00',
  booking_end_time        time DEFAULT '17:00',
  available_days          text[] DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  allow_guest_booking     boolean DEFAULT true,
  require_booking_approval boolean DEFAULT true,
  primary_color           text DEFAULT '#007AFF',
  logo_url                text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- ============================================================
-- 3. client_portal_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS client_portal_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active       boolean DEFAULT true,
  invited_at      timestamptz DEFAULT now(),
  last_login_at   timestamptz,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT client_portal_accounts_unique UNIQUE (client_id, organization_id),
  CONSTRAINT client_portal_accounts_user_unique UNIQUE (user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_accounts_user_id
  ON client_portal_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_client_portal_accounts_client_id
  ON client_portal_accounts(client_id);

CREATE INDEX IF NOT EXISTS idx_client_portal_accounts_org_id
  ON client_portal_accounts(organization_id);

CREATE INDEX IF NOT EXISTS idx_client_portal_settings_org_id
  ON client_portal_settings(organization_id);

CREATE INDEX IF NOT EXISTS idx_clients_portal_email
  ON clients(portal_email) WHERE portal_email IS NOT NULL;

-- ============================================================
-- 4. RLS helper functions for portal clients
-- ============================================================

-- Returns the client_id linked to the current auth user's portal account
CREATE OR REPLACE FUNCTION get_portal_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT client_id
  FROM client_portal_accounts
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- Returns the organization_id for the current portal client
CREATE OR REPLACE FUNCTION get_portal_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT organization_id
  FROM client_portal_accounts
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- Boolean check: is the current auth user the portal account holder for this client?
CREATE OR REPLACE FUNCTION is_portal_client_for(check_client_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_portal_accounts
    WHERE user_id = auth.uid()
      AND client_id = check_client_id
      AND is_active = true
  );
$$;

-- ============================================================
-- 5. Enable RLS on new tables
-- ============================================================
ALTER TABLE client_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS: client_portal_settings
-- ============================================================

-- Public (anon) can read settings for portals that are enabled
-- This lets the public landing page load branding without auth
CREATE POLICY "anon_read_enabled_portal_settings"
  ON client_portal_settings
  FOR SELECT
  TO anon
  USING (is_enabled = true);

-- Org members can read their own portal settings (regardless of enabled state)
CREATE POLICY "org_members_read_portal_settings"
  ON client_portal_settings
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id) OR organization_id = get_portal_org_id());

-- Only admins/owners can insert portal settings
CREATE POLICY "org_admins_insert_portal_settings"
  ON client_portal_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(organization_id));

-- Only admins/owners can update portal settings
CREATE POLICY "org_admins_update_portal_settings"
  ON client_portal_settings
  FOR UPDATE
  TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- Only admins/owners can delete portal settings
CREATE POLICY "org_admins_delete_portal_settings"
  ON client_portal_settings
  FOR DELETE
  TO authenticated
  USING (is_org_admin(organization_id));

-- ============================================================
-- 7. RLS: client_portal_accounts
-- ============================================================

-- Org members can see portal accounts for their org
CREATE POLICY "org_members_read_portal_accounts"
  ON client_portal_accounts
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id) OR user_id = auth.uid());

-- Only admins/owners can create portal accounts
CREATE POLICY "org_admins_insert_portal_accounts"
  ON client_portal_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(organization_id));

-- Only admins/owners can update portal accounts (e.g. deactivate)
CREATE POLICY "org_admins_update_portal_accounts"
  ON client_portal_accounts
  FOR UPDATE
  TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- Only admins/owners can delete portal accounts
CREATE POLICY "org_admins_delete_portal_accounts"
  ON client_portal_accounts
  FOR DELETE
  TO authenticated
  USING (is_org_admin(organization_id));

-- ============================================================
-- 8. RLS: portal clients can view their own data
-- ============================================================

-- clients: portal client can read their own client profile
CREATE POLICY "portal_client_view_own_profile"
  ON clients
  FOR SELECT
  TO authenticated
  USING (id = get_portal_client_id());

-- invoices: portal client can view their own invoices
CREATE POLICY "portal_client_view_own_invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    client_id IS NOT NULL
    AND client_id = get_portal_client_id()
  );

-- estimates: portal client can view their own estimates
CREATE POLICY "portal_client_view_own_estimates"
  ON estimates
  FOR SELECT
  TO authenticated
  USING (
    client_id IS NOT NULL
    AND client_id = get_portal_client_id()
  );

-- schedule_events: portal client can view their own scheduled appointments
CREATE POLICY "portal_client_view_own_schedule"
  ON schedule_events
  FOR SELECT
  TO authenticated
  USING (
    client_id IS NOT NULL
    AND client_id = get_portal_client_id()
  );

-- ============================================================
-- 9. Auto-update updated_at for client_portal_settings
-- ============================================================
CREATE OR REPLACE FUNCTION update_client_portal_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_portal_settings_updated_at ON client_portal_settings;
CREATE TRIGGER trg_client_portal_settings_updated_at
  BEFORE UPDATE ON client_portal_settings
  FOR EACH ROW EXECUTE FUNCTION update_client_portal_settings_updated_at();
