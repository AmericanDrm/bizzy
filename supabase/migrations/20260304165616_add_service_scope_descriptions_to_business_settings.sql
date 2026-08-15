/*
  # Add service scope descriptions to business settings

  1. Modified Tables
    - `business_settings`
      - `scope_description_full_service` (text) - Default description for Full Service scope
      - `scope_description_exterior_only` (text) - Default description for Exterior Only scope
      - `scope_description_interior_only` (text) - Default description for Interior Only scope

  2. Purpose
    - Allow businesses to define default descriptions for each service scope
    - These descriptions auto-populate invoice and estimate line items
    - Editable under Administration > Service Descriptions in Settings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'scope_description_full_service'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN scope_description_full_service text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'scope_description_exterior_only'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN scope_description_exterior_only text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'scope_description_interior_only'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN scope_description_interior_only text DEFAULT '';
  END IF;
END $$;