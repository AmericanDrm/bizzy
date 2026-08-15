/*
  # Add pane details and service scope to estimate items

  1. Modified Tables
    - `estimate_items`
      - `pane_details` (jsonb, nullable) - Structured pane breakdown (standard/french/storm with exterior/interior/divisional counts)
      - `service_scope` (text, nullable) - Service scope: full_service, exterior_only, or interior_only

  2. Important Notes
    - These columns allow estimate items to store detailed pane breakdowns
    - When an estimate is saved, this data can properly flow to client_unit_quantities
    - service_scope preserves the pricing split preference chosen during estimate creation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'pane_details'
  ) THEN
    ALTER TABLE estimate_items ADD COLUMN pane_details jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'service_scope'
  ) THEN
    ALTER TABLE estimate_items ADD COLUMN service_scope text DEFAULT NULL;
  END IF;
END $$;
