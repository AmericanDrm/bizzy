/*
  # Add Auto-Apply Tax Setting

  1. Changes
    - Add `auto_apply_tax` column to `business_settings` table
      - Type: boolean
      - Default: true (maintains current behavior)
      - Controls whether tax is automatically applied to new estimates and invoices
  
  2. Notes
    - Backward compatible: existing records default to true
    - When false, users must manually add tax using the "+ Tax" button
*/

-- Add auto_apply_tax column to business_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'auto_apply_tax'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN auto_apply_tax boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN business_settings.auto_apply_tax IS 'When true, automatically applies default tax rate to new estimates and invoices. When false, user must manually add tax.';
