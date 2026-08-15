/*
  # Add Default Startup Tab to Layout Preferences

  ## Summary
  Adds a `default_tab` column to `layout_preferences` so each user can choose
  which tab opens when the app launches (e.g., "schedule" instead of "index"/home).

  ## Changes
  - `layout_preferences` — new `default_tab` (text, nullable) column
    - NULL or 'index' means the home screen (existing behaviour)
    - Any valid tab id ('schedule', 'clients', 'invoices', etc.) redirects on launch

  ## Notes
  - Existing rows are unaffected; NULL defaults to home behaviour
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'layout_preferences' AND column_name = 'default_tab'
  ) THEN
    ALTER TABLE layout_preferences ADD COLUMN default_tab text DEFAULT NULL;
  END IF;
END $$;
