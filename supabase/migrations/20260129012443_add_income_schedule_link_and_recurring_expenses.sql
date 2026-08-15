/*
  # Add Schedule Event Link to Income and Recurring Expenses

  1. Modified Tables
    - `income`
      - `schedule_event_id` (uuid) - Links income to the scheduled job that generated it
    
    - `expenses`
      - `is_recurring` (boolean) - Whether this is a recurring expense
      - `recurrence_type` (text) - daily, weekly, biweekly, monthly, yearly
      - `recurrence_interval` (integer) - Interval between occurrences
      - `recurrence_end_date` (date) - When the recurrence ends
      - `last_generated_date` (date) - Last date an occurrence was generated
      - `parent_expense_id` (uuid) - Links generated expenses to their parent recurring expense

  2. Notes
    - schedule_event_id allows tracking which schedule event generated the income
    - Recurring expenses use a template model where the original expense is a template
    - Generated occurrences link back to their parent via parent_expense_id
*/

ALTER TABLE income ADD COLUMN IF NOT EXISTS schedule_event_id uuid REFERENCES schedule_events(id) ON DELETE SET NULL;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurrence_type text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT 1;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurrence_end_date date;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS last_generated_date date;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parent_expense_id uuid REFERENCES expenses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_income_schedule_event ON income(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_expenses_parent ON expenses(parent_expense_id);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(is_recurring) WHERE is_recurring = true;