/*
  # Add Notes Tabs to Layout Preferences

  1. Changes
    - Add `notes_tabs` column to `layout_preferences` table
    - Stores visibility and order of tabs within the Notes screen
    - Default: Notes and To-Do visible, Team and other features hidden in More menu

  2. Notes
    - Allows users to customize which notes tabs are visible
    - Maximum of 2 visible tabs + More tab
    - Hidden tabs appear in the More dropdown menu
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'layout_preferences' AND column_name = 'notes_tabs'
  ) THEN
    ALTER TABLE layout_preferences
    ADD COLUMN notes_tabs jsonb DEFAULT '[
      {"id": "notes", "visible": true},
      {"id": "todos", "visible": true},
      {"id": "team", "visible": false},
      {"id": "checklists", "visible": false},
      {"id": "supplies", "visible": false}
    ]'::jsonb;
  END IF;
END $$;