/*
  # Add Payment Status to Schedule Events

  1. Modified Tables
    - `schedule_events`
      - `payment_status` (text) - Status of payment: unpaid, paid, partial
      - `payment_method` (text) - How payment was made: cash, check, card, bank_transfer, other
      - `paid_date` (date) - When payment was received
      - `amount` (numeric) - Amount for the job
      - `amount_paid` (numeric) - Amount actually paid

  2. Notes
    - All new columns are nullable to support existing events
    - Default payment_status is 'unpaid'
*/

ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS paid_date date;
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS amount numeric(10,2);
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2);