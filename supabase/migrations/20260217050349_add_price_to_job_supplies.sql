/*
  # Add Price Field to Job Supplies

  1. Changes
    - Add `price` column to `job_supplies` table
      - Type: numeric (allows decimal values for prices)
      - Optional field (nullable)
      - Stores price per item when supplies are added to jobs

  2. Purpose
    - Preserves price information when supplies are sent to jobs
    - Allows tracking material costs per job
    - Helps with job costing and profitability analysis
*/

-- Add price column to job_supplies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_supplies' AND column_name = 'price'
  ) THEN
    ALTER TABLE job_supplies ADD COLUMN price numeric;
  END IF;
END $$;