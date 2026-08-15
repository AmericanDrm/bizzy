/*
  # Create Equipment Inventory & Client Equipment Tables

  ## Purpose
  Allows businesses to maintain a master list of their tools and equipment in Settings,
  then assign specific items from that list to each client profile. When a job is scheduled,
  the client's equipment list auto-populates as a checklist.

  ## New Tables

  1. `equipment_inventory`
     - Master list of all tools/equipment the business owns
     - `id` (uuid, primary key)
     - `organization_id` (uuid, FK to organizations)
     - `name` (text, required) - e.g. "24ft Extension Ladder", "Squeegee 18in"
     - `category` (text, optional) - e.g. "Ladders", "Hand Tools", "Safety"
     - `notes` (text, optional) - any notes about the item
     - `is_active` (boolean, default true) - soft-delete / hide without losing data
     - `sort_order` (integer, default 0) - display ordering
     - `created_by` (uuid, FK to auth.users)
     - `created_at`, `updated_at` (timestamptz)

  2. `client_equipment`
     - Join table: which equipment items are needed for a specific client
     - `id` (uuid, primary key)
     - `client_id` (uuid, FK to clients)
     - `equipment_id` (uuid, FK to equipment_inventory)
     - `organization_id` (uuid, FK to organizations)
     - `notes` (text, optional) - client-specific notes for this item
     - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Policies scoped to authenticated users within their organization
*/

-- Equipment Inventory: master list of tools/equipment
CREATE TABLE IF NOT EXISTS equipment_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text DEFAULT '',
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_inventory ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_equipment_inventory_org ON equipment_inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_active ON equipment_inventory(organization_id, is_active);

CREATE POLICY "Org members can view equipment inventory"
  ON equipment_inventory FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can insert equipment inventory"
  ON equipment_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can update equipment inventory"
  ON equipment_inventory FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can delete equipment inventory"
  ON equipment_inventory FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Client Equipment: which items from inventory are assigned to each client
CREATE TABLE IF NOT EXISTS client_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment_inventory(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, equipment_id)
);

ALTER TABLE client_equipment ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_client_equipment_client ON client_equipment(client_id);
CREATE INDEX IF NOT EXISTS idx_client_equipment_equipment ON client_equipment(equipment_id);
CREATE INDEX IF NOT EXISTS idx_client_equipment_org ON client_equipment(organization_id);

CREATE POLICY "Org members can view client equipment"
  ON client_equipment FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert client equipment"
  ON client_equipment FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete client equipment"
  ON client_equipment FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );
