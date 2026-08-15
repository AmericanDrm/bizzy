/*
  # Add Job Completion Tracking

  1. Modified Tables
    - `schedule_events`
      - `status` (text, default 'scheduled') - Job status: scheduled, completed
      - `completed_at` (timestamptz, nullable) - When the job was marked complete
      - `invoice_id` (uuid, nullable, FK to invoices) - Link to auto-generated invoice
    - `invoices`
      - `schedule_event_id` (uuid, nullable, FK to schedule_events) - Link back to originating schedule event

  2. Indexes
    - Index on invoices.schedule_event_id for fast lookups
    - Index on schedule_events.invoice_id for fast lookups
    - Index on schedule_events.status for filtering

  3. Notes
    - Bi-directional link between schedule_events and invoices for the "Complete Job" flow
    - Status field allows distinguishing completed jobs from scheduled ones
    - No destructive changes to existing data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'status'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN status text DEFAULT 'scheduled'
      CHECK (status IN ('scheduled', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'schedule_event_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN schedule_event_id uuid REFERENCES schedule_events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_schedule_event_id ON invoices(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_invoice_id ON schedule_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_status ON schedule_events(status);
