/*
  # Enhanced Estimates Features

  1. Changes to estimate_items table
    - Add `display_order` for reordering line items
    - Add `discount_amount` for per-item discounts
    - Add `discount_percentage` for percentage-based discounts
    - Add `is_optional` flag for optional items
    - Add `notes` for item-specific notes
    
  2. Changes to estimates table
    - Add `discount_amount` for overall estimate discount
    - Add `discount_percentage` for overall percentage discount
    
  3. Features Enabled
    - Reorder line items with drag-and-drop or buttons
    - Apply discounts per line item or overall
    - Mark items as optional
    - Add notes to individual line items
    - Better calculation with discounts
*/

-- =====================================================
-- PART 1: ENHANCE ESTIMATE_ITEMS TABLE
-- =====================================================

DO $$
BEGIN
  -- Add display_order column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE estimate_items 
    ADD COLUMN display_order integer DEFAULT 0;
  END IF;

  -- Add discount_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE estimate_items 
    ADD COLUMN discount_amount numeric(10, 2) DEFAULT 0;
  END IF;

  -- Add discount_percentage column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE estimate_items 
    ADD COLUMN discount_percentage numeric(5, 2) DEFAULT 0;
  END IF;

  -- Add is_optional column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'is_optional'
  ) THEN
    ALTER TABLE estimate_items 
    ADD COLUMN is_optional boolean DEFAULT false;
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'notes'
  ) THEN
    ALTER TABLE estimate_items 
    ADD COLUMN notes text;
  END IF;
END $$;

-- =====================================================
-- PART 2: ENHANCE ESTIMATES TABLE
-- =====================================================

DO $$
BEGIN
  -- Add discount_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE estimates 
    ADD COLUMN discount_amount numeric(10, 2) DEFAULT 0;
  END IF;

  -- Add discount_percentage column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE estimates 
    ADD COLUMN discount_percentage numeric(5, 2) DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- PART 3: CREATE INDEX FOR DISPLAY ORDER
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_estimate_items_display_order 
  ON estimate_items(estimate_id, display_order);