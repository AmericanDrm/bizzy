/*
  # Create short_links table for PDF short URLs

  ## Purpose
  Stores short, human-readable codes that redirect to full Supabase Storage PDF URLs.
  These are created when invoices or estimates are sent, using the memo or document number
  as the basis for the short code.

  ## New Tables
  - `short_links`
    - `id` (uuid, primary key)
    - `code` (text, unique) - URL-safe slug like "i-kitchen-remodel" or "i-20260001"
    - `target_url` (text) - Full Supabase Storage public URL for the PDF
    - `organization_id` (uuid, FK to organizations) - owner org for audit purposes
    - `document_type` (text) - 'invoice' or 'estimate'
    - `document_id` (uuid) - the invoice or estimate id
    - `created_at` (timestamptz)
    - `expires_at` (timestamptz) - 6 months after creation

  ## Security
  - Enable RLS
  - Public SELECT allowed so anyone with the code can be redirected (needed for email links)
  - INSERT/UPDATE restricted to authenticated users who belong to the owning org
  - DELETE restricted to authenticated users who belong to the owning org
*/

CREATE TABLE IF NOT EXISTS short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  target_url text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'estimate')),
  document_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 months')
);

CREATE UNIQUE INDEX IF NOT EXISTS short_links_code_idx ON short_links (code);
CREATE INDEX IF NOT EXISTS short_links_organization_id_idx ON short_links (organization_id);
CREATE INDEX IF NOT EXISTS short_links_document_id_idx ON short_links (document_id);
CREATE INDEX IF NOT EXISTS short_links_expires_at_idx ON short_links (expires_at);

ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view short links by code"
  ON short_links FOR SELECT
  USING (true);

CREATE POLICY "Org members can insert short links"
  ON short_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = short_links.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update short links"
  ON short_links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = short_links.organization_id
        AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = short_links.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete short links"
  ON short_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = short_links.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );
