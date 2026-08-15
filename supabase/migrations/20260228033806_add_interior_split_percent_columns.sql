/*
  # Add independent interior split percent columns

  1. Modified Tables
    - `job_types`
      - Added `interior_split_percent` (integer, nullable) - Global interior % for all pane types (0-100)
      - Added `interior_split_percent_standard` (integer, nullable) - Interior % for Standard panes (0-100)
      - Added `interior_split_percent_french` (integer, nullable) - Interior % for French panes (0-100)
      - Added `interior_split_percent_storm` (integer, nullable) - Interior % for Storm panes (0-100)

  2. Important Notes
    - Interior and exterior percentages are now independent and do not need to sum to 100%
    - When interior_split_percent is null, the system falls back to (100 - exterior_split_percent) for backwards compatibility
    - This allows scenarios like exterior = 60% and interior = 60% of full service price
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'interior_split_percent'
  ) THEN
    ALTER TABLE job_types ADD COLUMN interior_split_percent integer CHECK (interior_split_percent >= 0 AND interior_split_percent <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'interior_split_percent_standard'
  ) THEN
    ALTER TABLE job_types ADD COLUMN interior_split_percent_standard integer CHECK (interior_split_percent_standard >= 0 AND interior_split_percent_standard <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'interior_split_percent_french'
  ) THEN
    ALTER TABLE job_types ADD COLUMN interior_split_percent_french integer CHECK (interior_split_percent_french >= 0 AND interior_split_percent_french <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'interior_split_percent_storm'
  ) THEN
    ALTER TABLE job_types ADD COLUMN interior_split_percent_storm integer CHECK (interior_split_percent_storm >= 0 AND interior_split_percent_storm <= 100);
  END IF;
END $$;
