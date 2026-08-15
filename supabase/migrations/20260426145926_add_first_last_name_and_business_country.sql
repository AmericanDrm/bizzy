/*
  # Add First/Last Name to Clients and Country to Business Settings

  ## Summary
  Splits client names into first_name and last_name columns while keeping the
  existing name column for backwards compatibility and search. Also adds
  business_country to business_settings for country-aware phone formatting.

  ## New Columns

  ### clients table
  - `first_name` (text, default '') — client's first name
  - `last_name` (text, default '') — client's last name
  - Existing `name` column is preserved and used as display name / fallback

  ### business_settings table
  - `business_country` (text, default 'US') — ISO 3166-1 alpha-2 country code
    used to determine phone number formatting (e.g. 'US', 'GB', 'AU', 'CA')

  ## Notes
  - Existing `name` data is left untouched; new first_name/last_name start empty
  - The app will populate first_name/last_name going forward on save
  - The `name` column will be auto-computed from first_name + last_name on save
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE clients ADD COLUMN first_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_name text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'business_country'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN business_country text NOT NULL DEFAULT 'US';
  END IF;
END $$;
