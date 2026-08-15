/*
  # Add quick actions to layout preferences

  1. Changes
    - Add `quick_actions` column to `layout_preferences` table to store quick action customization preferences
    - Column is JSONB type to store array of action items with id and visibility
    - Defaults to NULL to allow gradual adoption

  2. Migration Safety
    - Uses IF NOT EXISTS pattern to prevent errors on re-run
    - Non-destructive addition only
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'layout_preferences' AND column_name = 'quick_actions'
  ) THEN
    ALTER TABLE layout_preferences ADD COLUMN quick_actions jsonb DEFAULT NULL;
  END IF;
END $$;
