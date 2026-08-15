/*
  # Address-Level Equipment Assignments

  ## Purpose
  Allow equipment to be assigned to specific client addresses. For example, a client with
  two properties might need a 32' ladder at one address but only a 16' ladder at another.

  ## New Tables
  1. `address_equipment`
    - `id` (uuid, primary key)
    - `address_id` (uuid, FK to client_addresses) - which address needs this equipment
    - `equipment_id` (uuid, FK to equipment_inventory) - which equipment item
    - `organization_id` (uuid, FK to organizations) - tenant isolation
    - `created_at` (timestamptz)
    - Unique constraint on (address_id, equipment_id) to prevent duplicates

  ## Security
  - RLS enabled
  - Org members can read, insert, and delete their own org's address equipment
*/

CREATE TABLE IF NOT EXISTS address_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id uuid NOT NULL REFERENCES client_addresses(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment_inventory(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(address_id, equipment_id)
);

ALTER TABLE address_equipment ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_address_equipment_address ON address_equipment(address_id);
CREATE INDEX IF NOT EXISTS idx_address_equipment_equipment ON address_equipment(equipment_id);
CREATE INDEX IF NOT EXISTS idx_address_equipment_org ON address_equipment(organization_id);

CREATE POLICY "Org members can view address equipment"
  ON address_equipment FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert address equipment"
  ON address_equipment FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete address equipment"
  ON address_equipment FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );
