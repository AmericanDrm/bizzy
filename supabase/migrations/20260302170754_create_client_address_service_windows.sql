/*
  # Create client address service windows table

  Replaces the single service_window_start/end approach with support for
  multiple availability windows per address, each optionally tied to specific days.

  Example: A client available Mon-Tue 2:00-5:00 PM AND Mon-Tue after 9:00 PM
  would have two rows — one for each window — both with days_of_week = ['monday','tuesday'].

  1. New Tables
    - `client_address_service_windows`
      - `id` (uuid, primary key)
      - `client_address_id` (uuid, FK to client_addresses)
      - `organization_id` (uuid, FK to organizations)
      - `window_start` (time) - Start of this availability window
      - `window_end` (time) - End of this availability window
      - `days_of_week` (text[]) - Which days this window applies (empty = all days)
      - `label` (text) - Optional label like "Morning" or "After hours"
      - `sort_order` (integer) - Display ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on new table
    - Policies for authenticated org members to manage their own windows

  3. Important Notes
    - The existing service_window_start/end columns on client_addresses remain for backward compatibility
    - When this new table has rows for an address, those take precedence
    - days_of_week uses lowercase day names: monday, tuesday, etc.
*/

CREATE TABLE IF NOT EXISTS client_address_service_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_address_id uuid NOT NULL REFERENCES client_addresses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  window_start time NOT NULL,
  window_end time NOT NULL,
  days_of_week text[] DEFAULT '{}',
  label text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_address_service_windows ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_casw_client_address_id ON client_address_service_windows(client_address_id);
CREATE INDEX IF NOT EXISTS idx_casw_organization_id ON client_address_service_windows(organization_id);

CREATE POLICY "Org members can view service windows"
  ON client_address_service_windows
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins and managers can insert service windows"
  ON client_address_service_windows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Org admins and managers can update service windows"
  ON client_address_service_windows
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Org admins and managers can delete service windows"
  ON client_address_service_windows
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
    )
  );
