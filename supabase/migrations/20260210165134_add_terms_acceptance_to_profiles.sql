/*
  # Add Terms and Privacy Acceptance Tracking

  1. Changes
    - Add `terms_accepted_at` column to profiles table
    - Add `privacy_accepted_at` column to profiles table
    - Add `terms_privacy_version` column to track which version was accepted

  2. Security
    - Users can only update their own terms acceptance
    - Terms acceptance is required during signup
*/

-- Add terms acceptance tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'terms_accepted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN terms_accepted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'privacy_accepted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN privacy_accepted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'terms_privacy_version'
  ) THEN
    ALTER TABLE profiles ADD COLUMN terms_privacy_version text DEFAULT '1.0';
  END IF;
END $$;
