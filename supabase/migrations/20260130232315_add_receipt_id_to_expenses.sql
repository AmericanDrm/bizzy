/*
  # Add receipt_id field to expenses table

  1. Changes
    - Add `receipt_id` column to expenses table
      - Allows linking multiple expenses created from the same receipt
      - Used when users split line items from a scanned receipt
      - Optional field (can be null for manually entered expenses)
  
  2. Notes
    - This enables batch expense creation from receipt scanning
    - Multiple expenses can share the same receipt_id
    - No foreign key constraint needed - just a grouping identifier
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'receipt_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN receipt_id uuid;
    CREATE INDEX IF NOT EXISTS idx_expenses_receipt_id ON expenses(receipt_id);
  END IF;
END $$;