/*
  # Add Per-Address Pane Counts

  ## Summary
  Makes client_unit_quantities per-address so each of a client's locations can have
  its own pane breakdown. This is backwards-compatible: existing rows where
  address_id IS NULL represent the "all addresses" / legacy per-client record.

  ## Changes
  1. `client_unit_quantities`
     - New optional column `address_id` → references `client_addresses(id)` ON DELETE SET NULL
     - The UNIQUE constraint on (client_id, job_type_id) is relaxed to
       (client_id, job_type_id, address_id) so each address can hold its own row.
     - Old rows keep address_id = NULL (backward-compat "default" record).

  ## Notes
  - address_id is nullable so legacy rows remain valid.
  - We drop the old unique constraint and add the new wider one.
  - RLS policies remain unchanged (org-level access already covers this table).
*/

ALTER TABLE client_unit_quantities
  ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES client_addresses(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'client_unit_quantities'
      AND constraint_name = 'client_unit_quantities_client_id_job_type_id_key'
  ) THEN
    ALTER TABLE client_unit_quantities
      DROP CONSTRAINT client_unit_quantities_client_id_job_type_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'client_unit_quantities'
      AND constraint_name = 'client_unit_quantities_client_job_type_address_key'
  ) THEN
    ALTER TABLE client_unit_quantities
      ADD CONSTRAINT client_unit_quantities_client_job_type_address_key
      UNIQUE (client_id, job_type_id, address_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_unit_quantities_address_id
  ON client_unit_quantities(address_id);
