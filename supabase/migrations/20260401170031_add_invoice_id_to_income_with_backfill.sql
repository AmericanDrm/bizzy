/*
  # Add invoice_id to income table

  ## Summary
  Links income records directly to invoices, enabling deduplication checks
  and ensuring no two income records can reference the same invoice.

  ## Changes

  ### Modified Tables
  - `income`
    - New column: `invoice_id` (uuid, nullable) — direct FK to invoices(id)
    - New unique constraint on `invoice_id` so only one income record can be
      linked to any given invoice
    - New index on `invoice_id` for query performance

  ## Data Backfill
  For existing income records that have a `schedule_event_id`, walk the chain
  `income.schedule_event_id -> schedule_events.invoice_id` and populate the
  new `invoice_id` column where a match exists.

  ## Notes
  - The unique constraint uses a partial index (WHERE invoice_id IS NOT NULL)
    so that multiple income records with no invoice link are still allowed
  - Existing data is safely backfilled without dropping or modifying other columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'income' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE income ADD COLUMN invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS income_invoice_id_unique
  ON income (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS income_invoice_id_idx
  ON income (invoice_id)
  WHERE invoice_id IS NOT NULL;

UPDATE income i
SET invoice_id = se.invoice_id
FROM schedule_events se
WHERE i.schedule_event_id = se.id
  AND se.invoice_id IS NOT NULL
  AND i.invoice_id IS NULL;
