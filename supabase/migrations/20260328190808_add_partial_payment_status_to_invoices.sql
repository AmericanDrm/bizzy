/*
  # Add 'partial' to invoices payment_status constraint

  ## Changes
  - Drops the existing invoices_payment_status_check constraint
  - Recreates it including 'partial' as a valid value

  ## Valid payment statuses after migration
  draft, sent, paid, overdue, cancelled, partial
*/

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_status_check;

ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_check
  CHECK (payment_status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'));
