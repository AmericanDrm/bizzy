/*
  # Link time entries to clients

  ## Summary
  Allows a time_entries row to be associated with a specific client (and optional address).
  This powers the "Service Record" tab on the client profile — when a user clocks in at a
  client site (manually or via auto location detection), that time entry appears in the
  client's service history.

  ## Changes
  1. Add `client_id` (uuid, nullable, FK -> clients.id ON DELETE SET NULL) to `time_entries`
  2. Add `client_address_id` (uuid, nullable, FK -> client_addresses.id ON DELETE SET NULL)
  3. Add index on `client_id` for fast client-scoped lookups

  ## Security
  No policy changes. Existing RLS on time_entries already scopes to the user/org.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE time_entries
      ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'client_address_id'
  ) THEN
    ALTER TABLE time_entries
      ADD COLUMN client_address_id uuid REFERENCES client_addresses(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client_address_id ON time_entries(client_address_id);
