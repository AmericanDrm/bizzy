/*
  # Add Payment Status to Invoices

  1. Changes
    - Add `payment_status` column (draft, sent, paid, overdue, cancelled)
    - Add `payment_method` column (cash, check, card, bank_transfer, other)
    - Add `paid_date` column (timestamp when payment received)
    - Add `amount_paid` column (track partial payments)
    
  2. Notes
    - Default payment_status is 'draft'
    - paid_date is null until payment received
    - amount_paid defaults to 0 for partial payment tracking
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_status text DEFAULT 'draft' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'paid_date'
  ) THEN
    ALTER TABLE invoices ADD COLUMN paid_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE invoices ADD COLUMN amount_paid numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add check constraint for payment_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payment_status_check'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_check 
    CHECK (payment_status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'));
  END IF;
END $$;

-- Add check constraint for payment_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payment_method_check'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_payment_method_check 
    CHECK (payment_method IN ('cash', 'check', 'card', 'bank_transfer', 'other') OR payment_method IS NULL);
  END IF;
END $$;