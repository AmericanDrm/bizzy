/*
  # Add Google Review URL, Notification Routing, and Portal Settings Enhancements

  ## Summary
  This migration adds several user-requested features:

  1. **Google Review URL on Clients**
     - Adds `google_review_url` column to the `clients` table
     - Allows businesses to store their Google review page URL per client record
     - Used to show a "Rate your service" prompt with a direct link

  2. **Notification Routing Preference**
     - Adds `notification_recipient` column to `business_settings`
     - Values: 'owner', 'admins', 'all' (defaults to 'owner')
     - Controls who receives new message/portal notifications

  3. **Google Review URL on Business Settings**
     - Adds `google_review_url` to `business_settings` table
     - Single org-wide Google review link used across all client records
     - Allows the business to configure once and appear on all client profiles

  ## Tables Modified
  - `clients`: added `google_review_url text`
  - `business_settings`: added `google_review_url text`, `notification_recipient text DEFAULT 'owner'`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'google_review_url'
  ) THEN
    ALTER TABLE clients ADD COLUMN google_review_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'google_review_url'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN google_review_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'notification_recipient'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN notification_recipient text DEFAULT 'owner';
  END IF;
END $$;
