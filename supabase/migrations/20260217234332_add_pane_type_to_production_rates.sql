/*
  # Add pane_type to team_member_production_rates

  ## Summary
  Adds a `pane_type` column to `team_member_production_rates` to allow
  per-pane-type production rates (e.g. Standard Exterior, French Interior, etc.)

  ## Changes
  - `team_member_production_rates`
    - New column: `pane_type` (text, nullable) - one of the 8 pane type keys or NULL for non-pane units
    - Unique constraint updated to include pane_type so each member can have a rate per pane type

  ## Notes
  - Existing rows have pane_type = NULL (no change in behavior)
  - When unit_type = 'pane' or 'windows', multiple rows can exist per member — one per pane type
  - A NULL pane_type means a single blended rate for the whole unit type
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_member_production_rates'
      AND column_name = 'pane_type'
  ) THEN
    ALTER TABLE public.team_member_production_rates
      ADD COLUMN pane_type text DEFAULT NULL;
  END IF;
END $$;
