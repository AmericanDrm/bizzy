/*
  # Add Client Property Qualities Table

  ## Summary
  Creates a new `client_property_qualities` table to store user-defined measurement
  categories for client properties (e.g., "Gutter Cleaning - 150 linear ft",
  "Driveway - 800 sq ft"). These supplement the existing job-type-based
  `client_unit_quantities` and allow fully custom, free-form categories that
  are not tied to a specific job type.

  ## New Tables

  ### `client_property_qualities`
  - `id` (uuid, PK)
  - `client_id` (uuid, FK → clients) - which client this belongs to
  - `address_id` (uuid, FK → client_addresses, nullable) - address-specific or global
  - `organization_id` (uuid, FK → organizations)
  - `label` (text) - user-defined name, e.g. "Gutter Cleaning", "Fence Line"
  - `unit_type` (text) - one of: 'linear_ft', 'sqft', 'pane', 'item', 'custom'
  - `custom_unit_label` (text, nullable) - used when unit_type = 'custom'
  - `quantity` (numeric) - the stored total measurement
  - `tally` (numeric) - optional running tally counter (separate from total)
  - `sort_order` (int) - display ordering
  - `created_at`, `updated_at` (timestamptz)

  ## Security
  - RLS enabled with org-scoped policies
  - Members and admins can read/write their org's data
*/

CREATE TABLE IF NOT EXISTS client_property_qualities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  address_id uuid REFERENCES client_addresses(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  unit_type text NOT NULL DEFAULT 'linear_ft',
  custom_unit_label text,
  quantity numeric NOT NULL DEFAULT 0,
  tally numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpq_client_id ON client_property_qualities(client_id);
CREATE INDEX IF NOT EXISTS idx_cpq_address_id ON client_property_qualities(address_id);
CREATE INDEX IF NOT EXISTS idx_cpq_org_id ON client_property_qualities(organization_id);

ALTER TABLE client_property_qualities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can select client_property_qualities"
  ON client_property_qualities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert client_property_qualities"
  ON client_property_qualities FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update client_property_qualities"
  ON client_property_qualities FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete client_property_qualities"
  ON client_property_qualities FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
