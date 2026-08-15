/*
  # Add Smart Address Autofill Setting

  1. Changes
    - Add `smart_address_autofill_enabled` column to `organization_defaults`
    - Add `smart_address_autofill_radius_meters` column for configurable radius
    - Default values: enabled = true, radius = 100 meters
  
  2. Notes
    - When enabled, estimates will auto-detect location and autofill address if no nearby clients found
    - Radius determines how close a client address must be to skip autofill
*/

-- Add smart address autofill settings to organization_defaults
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_defaults' AND column_name = 'smart_address_autofill_enabled'
  ) THEN
    ALTER TABLE organization_defaults 
    ADD COLUMN smart_address_autofill_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_defaults' AND column_name = 'smart_address_autofill_radius_meters'
  ) THEN
    ALTER TABLE organization_defaults 
    ADD COLUMN smart_address_autofill_radius_meters integer DEFAULT 100;
  END IF;
END $$;
