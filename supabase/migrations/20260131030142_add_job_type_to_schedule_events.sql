/*
  # Add Job Type to Schedule Events

  1. Changes
    - Add `job_type_id` column to schedule_events table
    - Links schedule events to job types for better categorization and pricing

  2. Purpose
    - Enable job type selection when creating schedule events
    - Allow automatic pricing based on job type hourly rate
    - Improve job categorization and reporting
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'job_type_id'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN job_type_id uuid REFERENCES job_types(id) ON DELETE SET NULL;
  END IF;
END $$;
