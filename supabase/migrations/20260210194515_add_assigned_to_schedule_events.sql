/*
  # Add Job Assignment to Schedule Events

  1. Changes
    - Add `assigned_to` column to `schedule_events` table
      - Allows assigning a job to a specific team member
      - References `auth.users` table
      - Can be null (unassigned jobs)
    - Add index for faster assignment queries

  2. Security
    - No RLS changes needed - existing policies handle access
    - Assignment can only be set by users with access to the event
*/

-- Add assigned_to column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_schedule_events_assigned_to ON schedule_events(assigned_to);