/*
  # Add dominant_hand to layout_preferences

  ## Summary
  Adds a `dominant_hand` column to the `layout_preferences` table so users can
  configure whether the FAB and other primary action buttons should appear on
  the right side (default, right-hand friendly) or the left side (left-hand mode).

  ## Changes
  - `layout_preferences`: new text column `dominant_hand` with default `'right'`
    - Allowed values: 'right' | 'left'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'layout_preferences' AND column_name = 'dominant_hand'
  ) THEN
    ALTER TABLE layout_preferences ADD COLUMN dominant_hand text NOT NULL DEFAULT 'right';
  END IF;
END $$;
