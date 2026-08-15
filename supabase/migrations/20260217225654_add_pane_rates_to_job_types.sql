/*
  # Add pane_rates to job_types

  ## Summary
  Adds a `pane_rates` JSONB column to the `job_types` table to support
  per-pane-type pricing. When a job type uses 'pane' as its unit of measure,
  this column can store different rates for each pane category.

  ## Changes

  ### Modified Tables
  - `job_types`
    - Added `pane_rates` (jsonb, nullable) — stores per-type rate overrides.
      Structure mirrors PaneDetails keys:
      {
        standard_exterior?: number,
        standard_interior?: number,
        standard_divisional?: number,
        french_exterior?: number,
        french_interior?: number,
        french_divisional?: number,
        storm_exterior?: number,
        storm_interior?: number
      }
      Any key not present falls back to the job type's base `hourly_rate`.

  ## Notes
  - Existing job types default to NULL (meaning all panes use the base rate)
  - Only relevant when unit_of_measure = 'pane'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'pane_rates'
  ) THEN
    ALTER TABLE job_types ADD COLUMN pane_rates jsonb DEFAULT NULL;
  END IF;
END $$;
