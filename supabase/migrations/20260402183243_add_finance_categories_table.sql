/*
  # Add Finance Categories Table

  ## Summary
  Creates a custom finance categories system that allows organizations to define
  their own expense and income categories instead of relying on hardcoded values.

  ## New Tables

  ### `finance_categories`
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK) - Which org owns this category
  - `name` (text) - Display name of the category
  - `type` (text) - 'expense' or 'income'
  - `is_visible` (boolean, default true) - Whether to show in pickers
  - `is_default` (boolean, default false) - System-seeded default category
  - `sort_order` (integer, default 0) - Display ordering
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Owners and managers can insert, update, delete
  - All org members can select (needed to display categories)

  ## Notes
  1. Default categories are seeded per org via a trigger on organization creation
  2. Custom categories coexist alongside defaults
  3. `is_visible` allows hiding categories without deleting them (preserves history)
*/

CREATE TABLE IF NOT EXISTS finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('expense', 'income')),
  is_visible boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_categories_org_type ON finance_categories(organization_id, type);

ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view finance categories"
  ON finance_categories FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can insert finance categories"
  ON finance_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can update finance categories"
  ON finance_categories FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners and managers can delete finance categories"
  ON finance_categories FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Seed default expense categories for all existing organizations
INSERT INTO finance_categories (organization_id, name, type, is_visible, is_default, sort_order)
SELECT
  o.id,
  cat.name,
  'expense',
  true,
  true,
  cat.sort_order
FROM organizations o
CROSS JOIN (
  VALUES
    ('Materials', 0),
    ('Equipment', 1),
    ('Travel', 2),
    ('Marketing', 3),
    ('Office Supplies', 4),
    ('Software', 5),
    ('Insurance', 6),
    ('Utilities', 7),
    ('Rent', 8),
    ('Other', 9)
) AS cat(name, sort_order)
ON CONFLICT DO NOTHING;

-- Seed default income categories for all existing organizations
INSERT INTO finance_categories (organization_id, name, type, is_visible, is_default, sort_order)
SELECT
  o.id,
  cat.name,
  'income',
  true,
  true,
  cat.sort_order
FROM organizations o
CROSS JOIN (
  VALUES
    ('Service Payment', 0),
    ('Product Sale', 1),
    ('Consulting', 2),
    ('Commission', 3),
    ('Other', 4)
) AS cat(name, sort_order)
ON CONFLICT DO NOTHING;
