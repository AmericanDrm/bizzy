/*
  # Add service_scope to client_addresses

  ## Summary
  Adds a `service_scope` column to the `client_addresses` table so that each
  client address can record the default service level (Full Service vs Exterior Only)
  for pane-cleaning jobs. This value is used by the client module to pre-populate
  invoices and estimates with the correct scope.

  ## Changes
  - `client_addresses`: new nullable text column `service_scope`
    - Allowed values: 'full_service' | 'exterior_only' | NULL (inherit from job type default)

  ## Notes
  - Existing rows default to NULL (no override — job-type default applies)
  - No data is lost; this is a purely additive change
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'service_scope'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN service_scope text DEFAULT NULL;
  END IF;
END $$;
