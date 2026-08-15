/*
  # Add new recurrence types and month column

  1. Schema Changes
    - Update `schedule_events_recurrence_type_check` constraint to allow:
      'quarterly', 'semi_annual', 'yearly' in addition to existing types
    - Add `recurrence_month` column (integer 1-12) for yearly recurrence

  2. Details
    - Quarterly and semi-annual support week-of-month + day-of-week scheduling
    - Yearly supports selecting a specific month and day of month
    - Existing data is not affected
*/

ALTER TABLE schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_recurrence_type_check;

ALTER TABLE schedule_events
  ADD CONSTRAINT schedule_events_recurrence_type_check
  CHECK (
    recurrence_type IS NULL
    OR recurrence_type = ANY (ARRAY[
      'none'::text,
      'daily'::text,
      'weekly'::text,
      'biweekly'::text,
      'monthly'::text,
      'quarterly'::text,
      'semi_annual'::text,
      'yearly'::text,
      'custom'::text
    ])
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'recurrence_month'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN recurrence_month integer;
  END IF;
END $$;

ALTER TABLE schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_recurrence_month_check;

ALTER TABLE schedule_events
  ADD CONSTRAINT schedule_events_recurrence_month_check
  CHECK (recurrence_month IS NULL OR (recurrence_month >= 1 AND recurrence_month <= 12));
