/*
  # Add Default Supply Template to Clients

  ## Purpose
  Allows businesses to assign a default equipment/supply list to each client.
  When a new job is scheduled for that client, the supply list is automatically attached.

  ## Changes
  1. New column on `clients` table:
     - `default_supply_template_id` (uuid, nullable, FK → supply_templates)
       Stores the default supply template to auto-apply when creating jobs for this client.

  2. Index for the new foreign key column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'default_supply_template_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN default_supply_template_id uuid REFERENCES supply_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_default_supply_template
  ON clients(default_supply_template_id)
  WHERE default_supply_template_id IS NOT NULL;
