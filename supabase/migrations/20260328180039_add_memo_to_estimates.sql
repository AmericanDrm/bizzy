/*
  # Add memo column to estimates table

  1. Changes
    - `estimates` table: adds nullable `memo` text column
      - Used as a human-readable label for the estimate (e.g., "Spring Cleaning – 123 Main St")
      - When filled, replaces the estimate number on PDFs, email subjects, and the invoices screen

  2. Notes
    - Safe, additive migration using IF NOT EXISTS check
    - No RLS changes required (estimates table already has RLS enabled)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'memo'
  ) THEN
    ALTER TABLE estimates ADD COLUMN memo text;
  END IF;
END $$;
