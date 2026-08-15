/*
  # Add Job Category to Time Entries

  ## Summary
  Adds a job_category_id column to time_entries so the Job Timer can tag a session
  with a high-level category (e.g., "Gutter Cleaning", "Window Cleaning", "Christmas Lights")
  instead of a specific job type variant.

  ## Changes
  ### Modified Tables
  - `time_entries`
    - `job_category_id` (uuid, nullable, FK to job_type_categories) - The work category for this timer session

  ## Security
  - No RLS changes needed; existing policies on time_entries cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'job_category_id'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN job_category_id uuid REFERENCES job_type_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_entries_job_category_id ON time_entries(job_category_id);
