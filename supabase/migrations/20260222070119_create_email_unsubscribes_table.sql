/*
  # Create email unsubscribes table

  1. New Tables
    - `email_unsubscribes`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `email` (text, the email address that unsubscribed)
      - `reason` (text, optional reason provided by the user)
      - `unsubscribed_at` (timestamptz, when the unsubscribe occurred)
      - `created_at` (timestamptz, record creation time)

  2. Indexes
    - Unique constraint on (organization_id, email) to prevent duplicates
    - Index on organization_id for fast lookups during email sending

  3. Security
    - Enable RLS on `email_unsubscribes` table
    - Policy for org owners/admins to view unsubscribes for their org
    - No public write access (writes happen via service role in edge functions)

  4. Notes
    - This table tracks which email addresses have opted out of receiving
      emails from a specific organization
    - Email sending functions should check this table before sending
    - The unique constraint ensures an email can only unsubscribe once per org
*/

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text DEFAULT '',
  unsubscribed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_unsubscribes_org_email
  ON email_unsubscribes (organization_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_org_id
  ON email_unsubscribes (organization_id);

ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owners and admins can view unsubscribes"
  ON email_unsubscribes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = email_unsubscribes.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners and admins can delete unsubscribes"
  ON email_unsubscribes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = email_unsubscribes.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );
