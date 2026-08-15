/*
  # Add Job Type to Time Entries

  ## Summary
  Adds a job_type_id column to time_entries so that a timer session can be
  associated with a specific type of work (e.g., Window Cleaning, Gutter Cleaning).
  This enables reporting by job type and richer context for each time entry.

  ## Changes
  ### Modified Tables
  - `time_entries`
    - `job_type_id` (uuid, nullable, FK to job_types) - The type of work being performed

  ## Security
  - No RLS changes needed; existing policies on time_entries cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'job_type_id'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN job_type_id uuid REFERENCES job_types(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_entries_job_type_id ON time_entries(job_type_id);
