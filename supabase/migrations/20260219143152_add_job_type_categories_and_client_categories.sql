/*
  # Add Job Type Categories and Client Category Tags

  ## Overview
  Introduces a category system for organizing job types and tagging clients.

  ## New Tables

  ### `job_type_categories`
  - `id` (uuid, primary key)
  - `organization_id` (uuid, FK to organizations)
  - `name` (text) - e.g. "Window Cleaning", "Gutter Cleaning"
  - `color` (text) - optional hex color for display
  - `sort_order` (int) - for custom ordering
  - `created_at` (timestamptz)

  ### `client_categories`
  - `id` (uuid, primary key)
  - `client_id` (uuid, FK to clients)
  - `category_id` (uuid, FK to job_type_categories)
  - `organization_id` (uuid, FK to organizations)
  - `created_at` (timestamptz)
  - Unique constraint on (client_id, category_id)

  ## Modified Tables

  ### `job_types`
  - Adds `category_id` (uuid, nullable FK to job_type_categories)

  ## Security
  - RLS enabled on both new tables
  - Authenticated org members can read/insert/update/delete their org's data
*/

CREATE TABLE IF NOT EXISTS job_type_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#1B4D6E',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_type_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can select job_type_categories"
  ON job_type_categories FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert job_type_categories"
  ON job_type_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update job_type_categories"
  ON job_type_categories FOR UPDATE
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

CREATE POLICY "Org members can delete job_type_categories"
  ON job_type_categories FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE job_types ADD COLUMN category_id uuid REFERENCES job_type_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_types_category_id ON job_types(category_id);
CREATE INDEX IF NOT EXISTS idx_job_type_categories_org_id ON job_type_categories(organization_id);

CREATE TABLE IF NOT EXISTS client_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES job_type_categories(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, category_id)
);

ALTER TABLE client_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can select client_categories"
  ON client_categories FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert client_categories"
  ON client_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete client_categories"
  ON client_categories FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_client_categories_client_id ON client_categories(client_id);
CREATE INDEX IF NOT EXISTS idx_client_categories_category_id ON client_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_client_categories_org_id ON client_categories(organization_id);
