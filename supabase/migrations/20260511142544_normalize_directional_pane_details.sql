/*
  # Normalize legacy directional pane_details keys

  1. Goal
    Collapse legacy directional pane-detail keys
    (`*_exterior`, `*_interior`, `*_divisional`) onto their modern
    per-pane-type keys (`standard`, `french`, `storm`, `skylights`,
    `commercial`) in `client_unit_quantities` so downstream pricing
    logic sees a single canonical shape.

  2. Logic (per row)
    For each base type:
      - If the row has a non-zero modern key, keep it as-is.
      - Otherwise rebuild from max(exterior, interior) + divisional.
    After rebuilding, verify the breakdown sum equals `quantity`.
    If not, fall back to `{ standard: quantity }` for safety rather
    than persisting an inconsistent mixed breakdown.

  3. Safety
    - Only rows that actually contain a directional key are touched.
    - Zero-valued directional keys are simply dropped.
    - Rows with no breakdown are untouched.
*/

DO $$
DECLARE
  r RECORD;
  base_types TEXT[] := ARRAY['standard','french','storm','skylights','commercial'];
  bt TEXT;
  modern_val INT;
  ext_val INT;
  int_val INT;
  div_val INT;
  result_val INT;
  new_pd JSONB;
  new_sum INT;
  qty INT;
BEGIN
  FOR r IN
    SELECT id, quantity, pane_details
    FROM client_unit_quantities
    WHERE pane_details::text ~ '(_exterior|_interior|_divisional)'
  LOOP
    new_pd := '{}'::jsonb;
    new_sum := 0;
    qty := COALESCE(r.quantity::INT, 0);

    FOREACH bt IN ARRAY base_types LOOP
      modern_val := COALESCE((r.pane_details ->> bt)::INT, 0);
      ext_val := COALESCE((r.pane_details ->> (bt || '_exterior'))::INT, 0);
      int_val := COALESCE((r.pane_details ->> (bt || '_interior'))::INT, 0);
      div_val := COALESCE((r.pane_details ->> (bt || '_divisional'))::INT, 0);

      IF modern_val > 0 THEN
        result_val := modern_val;
      ELSE
        result_val := GREATEST(ext_val, int_val) + div_val;
      END IF;

      IF result_val > 0 THEN
        new_pd := new_pd || jsonb_build_object(bt, result_val);
        new_sum := new_sum + result_val;
      END IF;
    END LOOP;

    IF new_sum <> qty THEN
      new_pd := jsonb_build_object('standard', qty);
    END IF;

    UPDATE client_unit_quantities
    SET pane_details = new_pd,
        updated_at = now()
    WHERE id = r.id;
  END LOOP;
END $$;
