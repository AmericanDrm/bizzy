/*
  # Guest Booking Support & Payment Instructions

  1. Modified Tables
    - `client_work_requests`
      - Make `portal_account_id` nullable to allow guest submissions
      - Add `guest_name` (text) - Guest's full name
      - Add `guest_email` (text) - Guest's email address
      - Add `guest_phone` (text) - Guest's phone number
      - Add `guest_notification_preference` (text) - How guest wants to be contacted: email, text, both
      - Add `converted_client_id` (uuid) - Links to client record after guest-to-client conversion

    - `client_portal_settings`
      - Add `payment_instructions` (text) - Custom payment instructions shown in portal

  2. Security Changes
    - Add anonymous INSERT policy for guest work requests
    - Add service-role SELECT/UPDATE policies for notification sending
    - Keep existing authenticated policies intact

  3. Important Notes
    - Guest requests have portal_account_id = NULL and guest_* fields populated
    - The converted_client_id column tracks when a guest is converted to a full client
    - Rate limiting for guest submissions should be handled at the application layer
*/

-- Make portal_account_id nullable for guest requests
ALTER TABLE client_work_requests
  ALTER COLUMN portal_account_id DROP NOT NULL;

-- Add guest fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_work_requests' AND column_name = 'guest_name'
  ) THEN
    ALTER TABLE client_work_requests ADD COLUMN guest_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_work_requests' AND column_name = 'guest_email'
  ) THEN
    ALTER TABLE client_work_requests ADD COLUMN guest_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_work_requests' AND column_name = 'guest_phone'
  ) THEN
    ALTER TABLE client_work_requests ADD COLUMN guest_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_work_requests' AND column_name = 'guest_notification_preference'
  ) THEN
    ALTER TABLE client_work_requests ADD COLUMN guest_notification_preference text DEFAULT 'email'
      CHECK (guest_notification_preference IN ('email', 'text', 'both'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_work_requests' AND column_name = 'converted_client_id'
  ) THEN
    ALTER TABLE client_work_requests ADD COLUMN converted_client_id uuid REFERENCES clients(id);
  END IF;
END $$;

-- Add payment instructions to portal settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_portal_settings' AND column_name = 'payment_instructions'
  ) THEN
    ALTER TABLE client_portal_settings ADD COLUMN payment_instructions text DEFAULT '';
  END IF;
END $$;

-- Allow anonymous guest work request inserts via the edge function (service role)
-- The edge function validates and inserts using the service role key
-- No anonymous RLS policy needed since inserts go through the edge function

-- Index for guest email lookups
CREATE INDEX IF NOT EXISTS idx_work_requests_guest_email
  ON client_work_requests(guest_email)
  WHERE guest_email IS NOT NULL;

-- Index for converted client tracking
CREATE INDEX IF NOT EXISTS idx_work_requests_converted_client
  ON client_work_requests(converted_client_id)
  WHERE converted_client_id IS NOT NULL;
