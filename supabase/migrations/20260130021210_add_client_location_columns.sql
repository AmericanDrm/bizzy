/*
  # Add Location Columns to Clients Table

  1. Changes
    - Add `latitude` column (numeric) to clients table for storing client location
    - Add `longitude` column (numeric) to clients table for storing client location

  2. Purpose
    - Enable proximity-based client matching for route optimization
    - Allow users to find nearby clients for efficient scheduling
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE clients ADD COLUMN latitude numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE clients ADD COLUMN longitude numeric;
  END IF;
END $$;