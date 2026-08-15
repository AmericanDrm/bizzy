/*
  # Add Payment Method to Income Table
  
  1. Changes
    - Add payment_method column to income table to track how payments were received
    - Allows values like 'cash', 'credit_card', 'venmo', 'cashapp', 'paypal', 'zelle', 'check', 'bank_transfer', etc.
  
  2. Notes
    - This field is optional as historical records may not have this information
    - Makes it easier to track payment trends and reconcile accounts
*/

-- Add payment_method column to income table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'income' 
    AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE income ADD COLUMN payment_method text;
    
    -- Add comment explaining the column
    COMMENT ON COLUMN income.payment_method IS 'Method used to receive payment: cash, credit_card, venmo, cashapp, paypal, zelle, check, bank_transfer, etc.';
  END IF;
END $$;