/*
  # Add Recurring Schedule Events

  1. Changes
    - Add `is_recurring` column (boolean) to mark recurring events
    - Add `recurrence_type` column (daily, weekly, biweekly, monthly, custom)
    - Add `recurrence_interval` column (every N periods)
    - Add `recurrence_days_of_week` column (array of days: 0-6 for Sun-Sat)
    - Add `recurrence_day_of_month` column (1-31 for monthly)
    - Add `recurrence_week_of_month` column (first, second, third, fourth, last)
    - Add `recurrence_end_date` column (when to stop recurring)
    - Add `parent_event_id` column (links instances to parent recurring event)
    
  2. Recurrence Types
    - daily: Repeats every day or every N days
    - weekly: Repeats every week on specific days
    - biweekly: Repeats every two weeks
    - monthly: Repeats monthly (by date or by week position)
    - custom: Flexible custom patterns

  3. Notes
    - is_recurring defaults to false
    - recurrence_week_of_month used for "first Monday", "third week", etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_events' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN is_recurring boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_events' AND column_name = 'recurrence_type'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN recurrence_type text DEFAULT 'none';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_events' AND column_name = 'recurrence_interval'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN recurrence_interval integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_events' AND column_name = 'recurrence_days_of_week'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN recurrence_days_of_week integer[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_events' AND column_name = 'recurrence_day_of_month'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN recurrence_day_of_month integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_events' AND column_name = 'recurrence_week_of_month'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN recurrence_week_of_month text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_events' AND column_name = 'recurrence_end_date'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN recurrence_end_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schedule_events' AND column_name = 'parent_event_id'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN parent_event_id uuid REFERENCES schedule_events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add check constraint for recurrence_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedule_events_recurrence_type_check'
  ) THEN
    ALTER TABLE schedule_events ADD CONSTRAINT schedule_events_recurrence_type_check 
    CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'custom') OR recurrence_type IS NULL);
  END IF;
END $$;

-- Add check constraint for recurrence_week_of_month
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedule_events_recurrence_week_check'
  ) THEN
    ALTER TABLE schedule_events ADD CONSTRAINT schedule_events_recurrence_week_check 
    CHECK (recurrence_week_of_month IN ('first', 'second', 'third', 'fourth', 'last') OR recurrence_week_of_month IS NULL);
  END IF;
END $$;

-- Create index for finding recurring events
CREATE INDEX IF NOT EXISTS idx_schedule_events_is_recurring ON schedule_events(is_recurring) WHERE is_recurring = true;

-- Create index for parent event lookup
CREATE INDEX IF NOT EXISTS idx_schedule_events_parent_id ON schedule_events(parent_event_id) WHERE parent_event_id IS NOT NULL;