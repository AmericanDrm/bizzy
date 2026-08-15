/*
  # Create Supply Templates Tables

  1. New Tables
    - `supply_templates` - Stores reusable supply list templates
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `title` (text, required)
      - `description` (text, optional)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `is_shared` (boolean, default true)
    
    - `supply_template_items` - Stores items in each supply template
      - `id` (uuid, primary key)
      - `template_id` (uuid, foreign key to supply_templates)
      - `organization_id` (uuid, foreign key to organizations)
      - `name` (text, required)
      - `quantity` (numeric, optional)
      - `unit` (text, optional)
      - `notes` (text, optional)
      - `display_order` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies for organization members to view, create, update, and delete
*/

-- Create supply_templates table
CREATE TABLE IF NOT EXISTS supply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_shared boolean DEFAULT true
);

-- Create supply_template_items table
CREATE TABLE IF NOT EXISTS supply_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES supply_templates(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric,
  unit text,
  notes text DEFAULT '',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE supply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_template_items ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supply_templates_org ON supply_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_supply_templates_created_by ON supply_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_supply_template_items_template ON supply_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_supply_template_items_org ON supply_template_items(organization_id);

-- RLS Policies for supply_templates

CREATE POLICY "Members can view supply templates"
  ON supply_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create supply templates"
  ON supply_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update supply templates"
  ON supply_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Non-basic users can delete supply templates"
  ON supply_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_templates.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'manager')
    )
  );

-- RLS Policies for supply_template_items

CREATE POLICY "Members can view supply template items"
  ON supply_template_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_template_items.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create supply template items"
  ON supply_template_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_template_items.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update supply template items"
  ON supply_template_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_template_items.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_template_items.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Non-basic users can delete supply template items"
  ON supply_template_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = supply_template_items.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'manager')
    )
  );

-- Add updated_at trigger for supply_templates
CREATE OR REPLACE FUNCTION update_supply_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supply_templates_updated_at ON supply_templates;
CREATE TRIGGER supply_templates_updated_at
  BEFORE UPDATE ON supply_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_supply_templates_updated_at();
