/*
  # Add estimate_id to jobs table

  1. Modified Tables
    - `jobs`
      - Added `estimate_id` (uuid, FK to estimates) - links a job back to the estimate it was created from
      - Added `priority` (text) - priority level for the job (low, medium, high, urgent)

  2. Security
    - No RLS changes needed, uses existing job policies

  3. Notes
    - Jobs can now be linked to their originating estimates
    - Priority helps organize and filter jobs by importance
*/

-- Add estimate_id to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'estimate_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN estimate_id uuid REFERENCES estimates(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_jobs_estimate_id ON jobs(estimate_id);
  END IF;
END $$;

-- Add priority to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'priority'
  ) THEN
    ALTER TABLE jobs ADD COLUMN priority text DEFAULT 'medium';
  END IF;
END $$;
