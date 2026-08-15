/*
  # Automatic SMS Phone Number Provisioning

  1. Changes
    - Add trigger to automatically provision a Twilio phone number when a new organization is created
    - Uses pg_net extension to call the provision-sms-number edge function asynchronously
    - Creates initial tenant_sms_settings record for new organizations

  2. Security
    - Uses service role key for internal API calls
    - Provisioning runs asynchronously to not block signup flow

  3. Notes
    - Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN secrets to be configured
    - Phone number provisioning is best-effort; failures are logged but don't block signup
*/

-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to provision SMS number for new organizations
CREATE OR REPLACE FUNCTION provision_sms_for_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
BEGIN
  -- Get Supabase URL from environment (set via vault or config)
  -- These are typically available as database settings
  SELECT current_setting('app.settings.supabase_url', true) INTO v_supabase_url;
  SELECT current_setting('app.settings.service_role_key', true) INTO v_service_role_key;
  
  -- If settings not available, try to construct from known patterns
  IF v_supabase_url IS NULL THEN
    -- Skip provisioning if we can't determine the URL
    -- The admin can manually provision later
    RAISE NOTICE 'Skipping auto SMS provisioning: Supabase URL not configured';
    RETURN NEW;
  END IF;

  -- Create initial SMS settings record (without phone number yet)
  INSERT INTO tenant_sms_settings (organization_id, is_active)
  VALUES (NEW.id, false)
  ON CONFLICT (organization_id) DO NOTHING;

  -- If we have the service role key, make the API call
  IF v_service_role_key IS NOT NULL AND v_supabase_url IS NOT NULL THEN
    BEGIN
      -- Make async HTTP request to provision SMS number
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/provision-sms-number',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'organization_id', NEW.id::text,
          'country', 'US'
        )
      ) INTO v_request_id;
      
      RAISE NOTICE 'SMS provisioning request sent for org %: request_id=%', NEW.id, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the organization creation
      RAISE NOTICE 'Failed to send SMS provisioning request for org %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on organizations table
DROP TRIGGER IF EXISTS trigger_provision_sms_on_org_create ON organizations;
CREATE TRIGGER trigger_provision_sms_on_org_create
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION provision_sms_for_new_organization();

-- Alternative: Create a simpler version that just creates the settings record
-- and relies on frontend to call provisioning
-- This is more reliable as it doesn't depend on pg_net or app settings

CREATE OR REPLACE FUNCTION create_sms_settings_for_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create initial SMS settings record for the new organization
  INSERT INTO tenant_sms_settings (
    organization_id,
    is_active,
    opt_in_keywords,
    opt_out_keywords,
    help_keywords,
    help_response,
    opt_out_response,
    opt_in_response
  )
  VALUES (
    NEW.id,
    false,
    ARRAY['START', 'YES', 'UNSTOP']::text[],
    ARRAY['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']::text[],
    ARRAY['HELP', 'INFO']::text[],
    'Reply STOP to unsubscribe. Reply START to resubscribe. For support, contact us at our main number.',
    'You have been unsubscribed and will no longer receive messages from us. Reply START to resubscribe.',
    'You have been resubscribed to receive messages from us. Reply STOP to unsubscribe.'
  )
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Use the simpler trigger that just creates settings
DROP TRIGGER IF EXISTS trigger_create_sms_settings_on_org ON organizations;
CREATE TRIGGER trigger_create_sms_settings_on_org
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_sms_settings_for_new_organization();