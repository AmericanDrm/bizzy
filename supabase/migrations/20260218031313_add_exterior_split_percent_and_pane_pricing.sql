/*
  # Add Pane Pricing Split Settings to Job Types

  ## Summary
  This migration adds structured pane pricing split columns to the job_types table,
  supporting per-pane-type exterior/interior percentage splits for Standard, French,
  and Storm pane categories.

  ## Changes

  ### Modified Tables
  - `job_types`
    - Added `exterior_split_percent_standard` (integer): Exterior % for Standard panes (0-100)
    - Added `exterior_split_percent_french` (integer): Exterior % for French panes (0-100)
    - Added `exterior_split_percent_storm` (integer): Exterior % for Storm panes (0-100)
    - Added `price_per_pane_standard` (numeric 10,2): Price per Standard pane override
    - Added `price_per_pane_french` (numeric 10,2): Price per French pane override
    - Added `price_per_pane_storm` (numeric 10,2): Price per Storm pane override

  ## Notes
  - All new columns are nullable; null = not configured
  - Null exterior_split_percent defaults to 100 in calculation utilities (no $0 errors)
  - Existing exterior_pct_standard and exterior_pct_french columns are preserved
  - Per-pane-type price overrides allow different pricing for pane styles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'exterior_split_percent_standard'
  ) THEN
    ALTER TABLE job_types ADD COLUMN exterior_split_percent_standard integer CHECK (exterior_split_percent_standard >= 0 AND exterior_split_percent_standard <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'exterior_split_percent_french'
  ) THEN
    ALTER TABLE job_types ADD COLUMN exterior_split_percent_french integer CHECK (exterior_split_percent_french >= 0 AND exterior_split_percent_french <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'exterior_split_percent_storm'
  ) THEN
    ALTER TABLE job_types ADD COLUMN exterior_split_percent_storm integer CHECK (exterior_split_percent_storm >= 0 AND exterior_split_percent_storm <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'price_per_pane_standard'
  ) THEN
    ALTER TABLE job_types ADD COLUMN price_per_pane_standard numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'price_per_pane_french'
  ) THEN
    ALTER TABLE job_types ADD COLUMN price_per_pane_french numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'price_per_pane_storm'
  ) THEN
    ALTER TABLE job_types ADD COLUMN price_per_pane_storm numeric(10,2);
  END IF;
END $$;
