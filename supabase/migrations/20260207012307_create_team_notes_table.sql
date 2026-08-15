/*
  # Create Team Notes Table

  1. New Tables
    - `team_notes`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `author_id` (uuid, references auth.users)
      - `title` (text, not null)
      - `content` (text, default '')
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `team_notes` table
    - All org members can read team notes
    - Only admins/owners can insert, update, and delete team notes

  3. Important Notes
    - Team notes are organization-scoped announcements
    - Only managers (admin role) and owners can create them
    - All organization members can view them
    - Uses the existing user_is_org_member function for RLS
    - A helper function user_is_org_admin_or_owner checks role for write access
*/

CREATE OR REPLACE FUNCTION user_is_org_admin_or_owner(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE TABLE IF NOT EXISTS team_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE team_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view team notes"
  ON team_notes FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Admins and owners can insert team notes"
  ON team_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_is_org_admin_or_owner(organization_id)
    AND auth.uid() = author_id
  );

CREATE POLICY "Admins and owners can update team notes"
  ON team_notes FOR UPDATE
  TO authenticated
  USING (user_is_org_admin_or_owner(organization_id))
  WITH CHECK (user_is_org_admin_or_owner(organization_id));

CREATE POLICY "Admins and owners can delete team notes"
  ON team_notes FOR DELETE
  TO authenticated
  USING (user_is_org_admin_or_owner(organization_id));

CREATE INDEX IF NOT EXISTS idx_team_notes_org_id ON team_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_author_id ON team_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_created_at ON team_notes(created_at);

CREATE OR REPLACE FUNCTION update_team_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_notes_updated_at
  BEFORE UPDATE ON team_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_team_notes_updated_at();
