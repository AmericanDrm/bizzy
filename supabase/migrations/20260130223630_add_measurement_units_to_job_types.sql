/*
  # Add Measurement Units to Job Types

  ## Overview
  This migration adds flexible unit of measurement fields to the job_types table to support various blue collar job measurement types (hours, linear feet, square footage, panes, flat rates, etc.).

  ## Changes to Existing Tables

  ### job_types table modifications
  - Add `unit_of_measure` (text) - The measurement unit (e.g., 'hour', 'sqft', 'linear_ft', 'pane', 'item', 'day', 'mile', 'flat_rate', 'custom')
  - Add `custom_unit_label` (text) - Custom label when unit_of_measure is 'custom'
  - Add `is_flat_rate` (boolean) - Indicates if this is a fixed price job (quantity always 1)
  - Rename conceptually: `hourly_rate` becomes `unit_rate` (but we'll keep the column name for backward compatibility)

  ## Default Values
  - `unit_of_measure`: Defaults to 'hour' for existing and new job types
  - `custom_unit_label`: Defaults to empty string
  - `is_flat_rate`: Defaults to false

  ## Data Migration
  - All existing job types will be set to 'hour' unit type
  - All existing job types will have is_flat_rate set to false

  ## Notes
  - No changes needed to invoice_items or estimate_items tables
  - The existing quantity and unit_price fields already support this flexibility
  - Maintains full backward compatibility with existing invoices and estimates
*/

-- Add new columns to job_types table
DO $$
BEGIN
  -- Add unit_of_measure column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_types' AND column_name = 'unit_of_measure'
  ) THEN
    ALTER TABLE job_types ADD COLUMN unit_of_measure text DEFAULT 'hour' NOT NULL;
  END IF;

  -- Add custom_unit_label column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_types' AND column_name = 'custom_unit_label'
  ) THEN
    ALTER TABLE job_types ADD COLUMN custom_unit_label text DEFAULT '';
  END IF;

  -- Add is_flat_rate column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_types' AND column_name = 'is_flat_rate'
  ) THEN
    ALTER TABLE job_types ADD COLUMN is_flat_rate boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Update existing job types to have default values
UPDATE job_types 
SET 
  unit_of_measure = 'hour',
  is_flat_rate = false,
  custom_unit_label = ''
WHERE unit_of_measure IS NULL OR unit_of_measure = '';

-- Add check constraint for valid unit types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_unit_of_measure'
  ) THEN
    ALTER TABLE job_types ADD CONSTRAINT valid_unit_of_measure 
    CHECK (unit_of_measure IN ('hour', 'sqft', 'linear_ft', 'pane', 'item', 'day', 'mile', 'flat_rate', 'custom'));
  END IF;
END $$;