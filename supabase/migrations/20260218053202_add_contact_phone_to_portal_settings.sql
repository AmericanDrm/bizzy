/*
  # Add contact_phone to client_portal_settings

  ## Overview
  Adds a `contact_phone` column to `client_portal_settings` so businesses can
  configure the phone number displayed to clients on the self-scheduling portal.
  This number is shown as a direct "Call Us" link during business hours, or
  presented alongside a callback request form outside business hours.

  ## Modified Tables

  ### client_portal_settings
  - `contact_phone` (text, nullable) - The phone number clients see when they
    need to reach the business directly. Displayed as a tel: link during
    business hours on the scheduling page.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_portal_settings' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE client_portal_settings ADD COLUMN contact_phone text DEFAULT '';
  END IF;
END $$;
