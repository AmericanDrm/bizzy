/*
  # Add Location Fields to Schedule Events

  1. Changes
    - Add `address` column to store job location address
    - Add `latitude` column to store GPS latitude
    - Add `longitude` column to store GPS longitude
    - These fields enable route optimization and proximity-based scheduling

  2. Notes
    - Location fields are optional to maintain backward compatibility
    - Latitude and longitude should be decimal degrees (e.g., 40.7128, -74.0060)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'address'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN latitude decimal(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN longitude decimal(11, 8);
  END IF;
END $$;