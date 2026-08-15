/*
  # Update Subscription Plans with Correct Limits and Pricing

  ## Summary
  Updates the existing subscription_plans table to reflect the finalized tier structure:
  - Bizzy Lite: $12/mo, 1 user, 50 clients
  - Bizzy Basic: $35/mo, 3 users, 125 clients
  - Bizzy Pro: $95/mo, 5 users, unlimited clients
  - Bizzy Corp: $180/mo, unlimited users, unlimited clients
  Additional users on any tier: $22/month

  ## Changes
  1. Adds `max_clients` column to subscription_plans if missing
  2. Adds `slug` column for code references
  3. Updates all plan records with correct limits, user caps, and feature flags
  4. Updates extra_user_price to $22 across all tiers
  5. Adds helper function get_org_subscription_info
  6. Creates lifecycle email queue table
  7. Auto-assigns Lite trial on new org creation
*/

-- Add missing columns to subscription_plans
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'max_clients') THEN
    ALTER TABLE subscription_plans ADD COLUMN max_clients integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'slug') THEN
    ALTER TABLE subscription_plans ADD COLUMN slug text;
  END IF;
END $$;

-- Update all plan records with correct values
UPDATE subscription_plans SET
  slug = 'lite',
  monthly_price = 12.00,
  included_users = 1,
  extra_user_price = 22.00,
  max_clients = 50,
  features = '{
    "scheduling": true,
    "invoicing": true,
    "job_notes_photos": true,
    "expense_tracking": true,
    "time_clock": false,
    "recurring_jobs": false,
    "estimates": false,
    "receipt_scanning": false,
    "sms": false,
    "messaging": false,
    "client_portal": false,
    "gps_tracking": false,
    "route_optimization": false,
    "analytics": false,
    "mileage_tracking": false,
    "work_orders": false,
    "broadcast_messaging": false,
    "custom_branding": false,
    "ai_assist": false,
    "camera": false,
    "notes_checklists": false,
    "client_management": true,
    "finances": false,
    "productivity_reports": false,
    "multi_location": false,
    "white_label": false
  }'::jsonb
WHERE id = 'lite';

UPDATE subscription_plans SET
  slug = 'basic',
  monthly_price = 35.00,
  included_users = 3,
  extra_user_price = 22.00,
  max_clients = 125,
  features = '{
    "scheduling": true,
    "invoicing": true,
    "job_notes_photos": true,
    "expense_tracking": true,
    "time_clock": true,
    "recurring_jobs": true,
    "estimates": true,
    "receipt_scanning": true,
    "sms": true,
    "messaging": true,
    "client_portal": true,
    "gps_tracking": false,
    "route_optimization": false,
    "analytics": false,
    "mileage_tracking": false,
    "work_orders": false,
    "broadcast_messaging": false,
    "custom_branding": false,
    "ai_assist": false,
    "camera": true,
    "notes_checklists": true,
    "client_management": true,
    "finances": true,
    "productivity_reports": false,
    "multi_location": false,
    "white_label": false
  }'::jsonb
WHERE id = 'basic';

UPDATE subscription_plans SET
  slug = 'pro',
  monthly_price = 95.00,
  included_users = 5,
  extra_user_price = 22.00,
  max_clients = NULL,
  features = '{
    "scheduling": true,
    "invoicing": true,
    "job_notes_photos": true,
    "expense_tracking": true,
    "time_clock": true,
    "recurring_jobs": true,
    "estimates": true,
    "receipt_scanning": true,
    "sms": true,
    "messaging": true,
    "client_portal": true,
    "gps_tracking": true,
    "route_optimization": true,
    "analytics": true,
    "mileage_tracking": true,
    "work_orders": true,
    "broadcast_messaging": true,
    "custom_branding": true,
    "ai_assist": true,
    "camera": true,
    "notes_checklists": true,
    "client_management": true,
    "finances": true,
    "productivity_reports": true,
    "multi_location": false,
    "white_label": false
  }'::jsonb
WHERE id = 'pro';

UPDATE subscription_plans SET
  slug = 'corp',
  monthly_price = 180.00,
  included_users = 9999,
  extra_user_price = 22.00,
  max_clients = NULL,
  features = '{
    "scheduling": true,
    "invoicing": true,
    "job_notes_photos": true,
    "expense_tracking": true,
    "time_clock": true,
    "recurring_jobs": true,
    "estimates": true,
    "receipt_scanning": true,
    "sms": true,
    "messaging": true,
    "client_portal": true,
    "gps_tracking": true,
    "route_optimization": true,
    "analytics": true,
    "mileage_tracking": true,
    "work_orders": true,
    "broadcast_messaging": true,
    "custom_branding": true,
    "ai_assist": true,
    "camera": true,
    "notes_checklists": true,
    "client_management": true,
    "finances": true,
    "productivity_reports": true,
    "multi_location": true,
    "white_label": true
  }'::jsonb
WHERE id = 'corp';

-- ─────────────────────────────────────────────
-- LIFECYCLE EMAIL QUEUE TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_lifecycle_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  owner_name text,
  org_name text NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('welcome', 'checkin_3mo', 'checkin_6mo', 'checkin_11mo14d')),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email_type)
);

ALTER TABLE organization_lifecycle_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owners can view their lifecycle emails"
  ON organization_lifecycle_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_lifecycle_emails.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

-- ─────────────────────────────────────────────
-- FUNCTION: schedule lifecycle emails for new org
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION schedule_org_lifecycle_emails(
  p_org_id uuid,
  p_owner_email text,
  p_owner_name text,
  p_org_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  INSERT INTO organization_lifecycle_emails
    (organization_id, owner_email, owner_name, org_name, email_type, scheduled_at, status)
  VALUES
    (p_org_id, p_owner_email, p_owner_name, p_org_name, 'welcome',        now_ts,                       'pending'),
    (p_org_id, p_owner_email, p_owner_name, p_org_name, 'checkin_3mo',    now_ts + interval '3 months', 'pending'),
    (p_org_id, p_owner_email, p_owner_name, p_org_name, 'checkin_6mo',    now_ts + interval '6 months', 'pending'),
    (p_org_id, p_owner_email, p_owner_name, p_org_name, 'checkin_11mo14d',now_ts + interval '345 days', 'pending')
  ON CONFLICT (organization_id, email_type) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────
-- HELPER RPC: get org subscription info for frontend
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_org_subscription_info(p_org_id uuid)
RETURNS TABLE (
  plan_id text,
  plan_slug text,
  plan_name text,
  status text,
  included_users integer,
  extra_users integer,
  total_allowed_users integer,
  max_clients integer,
  monthly_price numeric,
  extra_user_price numeric,
  features jsonb,
  trial_ends_at timestamptz,
  current_period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id::text,
    COALESCE(sp.slug, sp.id::text),
    sp.name,
    os.status,
    sp.included_users,
    os.extra_users,
    CASE WHEN sp.included_users >= 9999 THEN 9999
         ELSE sp.included_users + COALESCE(os.extra_users, 0)
    END,
    sp.max_clients,
    sp.monthly_price,
    sp.extra_user_price,
    sp.features,
    os.trial_ends_at,
    os.current_period_end
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.organization_id = p_org_id;
END;
$$;

-- ─────────────────────────────────────────────
-- TRIGGER: auto-assign Lite trial on org creation
-- (only if no subscription exists yet)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_default_subscription_on_org_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organization_subscriptions (
    organization_id,
    plan_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  VALUES (
    NEW.id,
    'lite',
    'trialing',
    now() + interval '14 days',
    now(),
    now() + interval '14 days'
  )
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_org_created_assign_subscription ON organizations;
CREATE TRIGGER on_org_created_assign_subscription
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_subscription_on_org_create();
