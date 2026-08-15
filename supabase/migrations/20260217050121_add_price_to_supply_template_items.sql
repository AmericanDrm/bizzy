/*
  # Add Price Field to Supply Template Items

  1. Changes
    - Add `price` column to `supply_template_items` table
      - Type: numeric (allows decimal values for prices)
      - Optional field (nullable)
      - Can store price per item to track material costs

  2. Purpose
    - Allows users to track the cost of each supply item
    - Helps monitor price changes over time
    - Useful for estimating job costs based on materials
*/

-- Add price column to supply_template_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supply_template_items' AND column_name = 'price'
  ) THEN
    ALTER TABLE supply_template_items ADD COLUMN price numeric;
  END IF;
END $$;