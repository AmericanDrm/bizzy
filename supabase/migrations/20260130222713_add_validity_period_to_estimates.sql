/*
  # Add Validity Period to Estimates

  ## Overview
  Adds validity period field to estimates table to support automatic valid_until date calculation.

  ## Changes
  1. Modified Tables
    - `estimates`
      - Added `validity_period` (text) - Validity period (e.g., '15_days', '30_days', '60_days', '90_days', '3_months', 'custom')
      - Stores the selected validity period for automatic valid_until date calculation

  ## Notes
  - Validity periods enable automatic valid_until date calculation when creating/editing estimates
  - Supported periods: 15 days, 30 days, 60 days, 90 days, 3 months, Custom
  - Default is '30_days' for backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'validity_period'
  ) THEN
    ALTER TABLE estimates ADD COLUMN validity_period text DEFAULT '30_days';
  END IF;
END $$;