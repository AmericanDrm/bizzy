/*
  # Add Secondary Contact and Quick-Send Notification Templates

  ## Summary
  Adds support for a secondary contact (spouse/other) on client profiles, and a table
  for storing reusable quick-send notification message templates per organization.

  ## New Columns on `clients`
  - `secondary_contact_name` (text) – Name of the secondary contact (e.g. spouse)
  - `secondary_contact_phone` (text) – Phone number for the secondary contact
  - `secondary_contact_email` (text) – Email for the secondary contact

  ## New Table: `quick_send_templates`
  Stores per-organization saved notification message templates.
  - `id` (uuid) – Primary key
  - `organization_id` (uuid) – Owning org, references organizations
  - `name` (text) – Short template name shown in the list
  - `message` (text) – The message body
  - `sort_order` (int) – Display ordering
  - `created_at` / `updated_at` (timestamptz)

  ## Security
  - RLS enabled on `quick_send_templates`
  - Only authenticated org members can select/insert/update/delete their own templates
*/

-- Add secondary contact columns to clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'secondary_contact_name'
  ) THEN
    ALTER TABLE clients ADD COLUMN secondary_contact_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'secondary_contact_phone'
  ) THEN
    ALTER TABLE clients ADD COLUMN secondary_contact_phone text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'secondary_contact_email'
  ) THEN
    ALTER TABLE clients ADD COLUMN secondary_contact_email text DEFAULT '';
  END IF;
END $$;

-- Create quick_send_templates table
CREATE TABLE IF NOT EXISTS quick_send_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quick_send_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can select quick send templates"
  ON quick_send_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = quick_send_templates.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert quick send templates"
  ON quick_send_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = quick_send_templates.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update quick send templates"
  ON quick_send_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = quick_send_templates.organization_id
        AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = quick_send_templates.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete quick send templates"
  ON quick_send_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = quick_send_templates.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_quick_send_templates_org_id
  ON quick_send_templates (organization_id);
