/*
  # Add Broadcast Templates Table

  ## Purpose
  Stores reusable message templates for sending broadcast messages to groups of clients.

  ## New Tables
  - `broadcast_templates`
    - `id` (uuid, primary key)
    - `organization_id` (uuid, foreign key to organizations)
    - `name` (text) - template display name
    - `message` (text) - template body, supports {client_name} placeholder
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled, only org members can read/write their own templates
*/

CREATE TABLE IF NOT EXISTS broadcast_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE broadcast_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_broadcast_templates_org ON broadcast_templates(organization_id);

CREATE POLICY "Org members can select broadcast templates"
  ON broadcast_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert broadcast templates"
  ON broadcast_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update broadcast templates"
  ON broadcast_templates FOR UPDATE
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

CREATE POLICY "Org members can delete broadcast templates"
  ON broadcast_templates FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
