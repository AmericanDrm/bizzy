/*
  # Add Messaging Service SID to tenant SMS settings

  1. Modified Tables
    - `tenant_sms_settings`
      - Added `messaging_service_sid` (text, nullable) - Stores the Twilio Messaging Service SID used for A2P 10DLC compliant message delivery

  2. Important Notes
    - After A2P 10DLC registration, carriers require messages to be sent through a registered Messaging Service
    - Messages sent directly from a phone number (without Messaging Service) get blocked with error 30034
    - This column enables the send-sms function to route messages through the correct Messaging Service
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_sms_settings' AND column_name = 'messaging_service_sid'
  ) THEN
    ALTER TABLE tenant_sms_settings ADD COLUMN messaging_service_sid text;
  END IF;
END $$;
