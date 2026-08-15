/*
  # Add Send Channel Preferences to Business Settings

  ## Summary
  Adds two new columns to the `business_settings` table that allow each organization
  to choose how they prefer to send emails and SMS messages.

  ## New Columns

  ### `email_send_channel`
  - Type: text
  - Default: 'native'
  - Values: 'native' (uses device share sheet / mail app) | 'mailgun' (uses configured Mailgun domain)
  - Allows orgs without Mailgun configured to still send invoices/estimates via their own mail app

  ### `sms_send_channel`
  - Type: text
  - Default: 'native'
  - Values: 'native' (opens device SMS app pre-filled) | 'twilio' (uses provisioned Twilio number)
  - Allows orgs without Twilio configured to still send SMS via their own SMS app

  ## Notes
  - Default is 'native' so new users work immediately without any configuration
  - Existing users who have Mailgun or Twilio configured are not affected — their existing
    credentials remain and they can switch to their configured provider in Settings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'email_send_channel'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN email_send_channel text DEFAULT 'native';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'sms_send_channel'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN sms_send_channel text DEFAULT 'native';
  END IF;
END $$;
