/*
  # Add commercial flag to route_templates

  ## Summary
  Adds a boolean column to route_templates so a template can be tagged as
  "commercial-only". Commercial templates appear in a dedicated section and
  can be reused month-to-month for repeat commercial chains or multi-location
  commercial clients.

  ## Changes
  - `route_templates`: new `is_commercial` boolean column (default false)

  ## Notes
  - No data loss. Existing routes default to false (non-commercial).
  - RLS on route_templates is already in place from the original migration.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_templates' AND column_name = 'is_commercial'
  ) THEN
    ALTER TABLE route_templates ADD COLUMN is_commercial boolean NOT NULL DEFAULT false;
  END IF;
END $$;
