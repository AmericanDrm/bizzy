/*
  # Add Organization Defaults System

  ## Overview
  This migration creates a system for organization owners/admins to set default
  preferences that are automatically applied to new team members when they join.

  1. New Tables
    - `organization_defaults`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `default_home_cards` (jsonb) - Default home card layout for new members
      - `default_tabs` (jsonb) - Default tab visibility and order for new members
      - `default_quick_actions` (jsonb) - Default quick actions for new members
      - `default_notes_tabs` (jsonb) - Default notes tabs for new members
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `organization_defaults` table
    - Only owners and admins can view/modify organization defaults
    - Members can view their organization's defaults (needed for auto-apply)

  3. Functionality
    - One defaults record per organization
    - Automatically applied when new members join
    - Can be customized by owners/admins
    - Provides consistent onboarding experience

  4. Default Values
    - Home cards: clients, schedule, time, invoices (visible)
    - Tabs: index, schedule, invoices, notes, finances (visible)
    - Quick actions: clients, schedule, time, invoices, finances (visible)
    - Notes tabs: notes, todos (visible)
*/

-- Create organization_defaults table
CREATE TABLE IF NOT EXISTS organization_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  default_home_cards jsonb DEFAULT '[
    {"id": "clients", "visible": true},
    {"id": "schedule", "visible": true},
    {"id": "time", "visible": true},
    {"id": "invoices", "visible": true}
  ]'::jsonb,
  default_tabs jsonb DEFAULT '[
    {"id": "index", "visible": true},
    {"id": "clients", "visible": false},
    {"id": "schedule", "visible": true},
    {"id": "time", "visible": false},
    {"id": "invoices", "visible": true},
    {"id": "notes", "visible": true},
    {"id": "finances", "visible": true}
  ]'::jsonb,
  default_quick_actions jsonb DEFAULT '[
    {"id": "clients", "visible": true},
    {"id": "schedule", "visible": true},
    {"id": "time", "visible": true},
    {"id": "invoices", "visible": true},
    {"id": "finances", "visible": true}
  ]'::jsonb,
  default_notes_tabs jsonb DEFAULT '[
    {"id": "notes", "visible": true},
    {"id": "todos", "visible": true},
    {"id": "team", "visible": false},
    {"id": "checklists", "visible": false},
    {"id": "supplies", "visible": false}
  ]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on organization_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_organization_defaults_organization_id
  ON organization_defaults(organization_id);

-- Enable RLS
ALTER TABLE organization_defaults ENABLE ROW LEVEL SECURITY;

-- Policy: All organization members can view defaults (needed for auto-apply on join)
CREATE POLICY "Organization members can view defaults"
  ON organization_defaults
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Policy: Only owners and admins can insert defaults
CREATE POLICY "Owners and admins can insert defaults"
  ON organization_defaults
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Policy: Only owners and admins can update defaults
CREATE POLICY "Owners and admins can update defaults"
  ON organization_defaults
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Policy: Only owners can delete defaults
CREATE POLICY "Owners can delete defaults"
  ON organization_defaults
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_defaults.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'owner'
    )
  );

-- Function to apply organization defaults to a new member
CREATE OR REPLACE FUNCTION apply_organization_defaults_to_member()
RETURNS TRIGGER AS $$
DECLARE
  org_defaults RECORD;
BEGIN
  -- Get organization defaults
  SELECT * INTO org_defaults
  FROM organization_defaults
  WHERE organization_id = NEW.organization_id;

  -- If defaults exist, create layout preferences for the new member
  IF FOUND THEN
    INSERT INTO layout_preferences (
      user_id,
      home_cards,
      tabs,
      quick_actions,
      notes_tabs,
      created_at,
      updated_at
    )
    VALUES (
      NEW.user_id,
      org_defaults.default_home_cards,
      org_defaults.default_tabs,
      org_defaults.default_quick_actions,
      org_defaults.default_notes_tabs,
      now(),
      now()
    )
    ON CONFLICT (user_id) DO NOTHING; -- Don't override existing preferences
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically apply defaults when a new member joins
CREATE TRIGGER apply_defaults_on_member_join
  AFTER INSERT ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION apply_organization_defaults_to_member();

-- Create default records for existing organizations
INSERT INTO organization_defaults (organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;