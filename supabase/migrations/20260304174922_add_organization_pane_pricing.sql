/*
  # Add Organization-Wide Pane Pricing Defaults

  1. New Tables
    - `organization_pane_pricing`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations, unique)
      - `price_per_pane_standard` (numeric) - default price for standard panes
      - `price_per_pane_french` (numeric) - default price for french panes
      - `price_per_pane_storm` (numeric) - default price for storm panes
      - `exterior_split_percent_standard` (integer) - exterior % for standard
      - `exterior_split_percent_french` (integer) - exterior % for french
      - `exterior_split_percent_storm` (integer) - exterior % for storm
      - `interior_split_percent_standard` (integer) - interior % for standard
      - `interior_split_percent_french` (integer) - interior % for french
      - `interior_split_percent_storm` (integer) - interior % for storm
      - `dynamic_pane_rates` (jsonb) - pricing for custom/dynamic pane types
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    - Stores a single set of pane pricing defaults per organization
    - When saved, these prices are automatically applied to ALL pane-based job types
    - New pane-based job types auto-populate from these defaults

  3. Security
    - Enable RLS on `organization_pane_pricing` table
    - Policies for authenticated org members to read
    - Policies for admin/manager to insert and update
*/

CREATE TABLE IF NOT EXISTS organization_pane_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  price_per_pane_standard numeric(10,2) DEFAULT NULL,
  price_per_pane_french numeric(10,2) DEFAULT NULL,
  price_per_pane_storm numeric(10,2) DEFAULT NULL,
  exterior_split_percent_standard integer DEFAULT NULL,
  exterior_split_percent_french integer DEFAULT NULL,
  exterior_split_percent_storm integer DEFAULT NULL,
  interior_split_percent_standard integer DEFAULT NULL,
  interior_split_percent_french integer DEFAULT NULL,
  interior_split_percent_storm integer DEFAULT NULL,
  dynamic_pane_rates jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE organization_pane_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read pane pricing"
  ON organization_pane_pricing
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can insert pane pricing"
  ON organization_pane_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update pane pricing"
  ON organization_pane_pricing
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can delete pane pricing"
  ON organization_pane_pricing
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_organization_pane_pricing_org_id
  ON organization_pane_pricing(organization_id);
