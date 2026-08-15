/*
  # Change time_per_unit to units_per_hour in job_types

  1. Schema Changes
    - Drop the old `time_per_unit` column from `job_types` table
    - Add new `units_per_hour` column to store how many units can be completed per hour
    - This represents a clearer, more intuitive metric for unit-based work

  2. Notes
    - Starting fresh - no data conversion from old column
    - units_per_hour should be a positive decimal value
    - NULL values allowed for non-unit-based job types (hourly or flat rate)
    - Default value is NULL to maintain backward compatibility
*/

-- Drop the old column
ALTER TABLE job_types DROP COLUMN IF EXISTS time_per_unit;

-- Add the new column
ALTER TABLE job_types ADD COLUMN IF NOT EXISTS units_per_hour decimal(10,2);

-- Add a check constraint to ensure positive values
ALTER TABLE job_types ADD CONSTRAINT units_per_hour_positive CHECK (units_per_hour IS NULL OR units_per_hour > 0);