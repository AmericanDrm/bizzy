/*
  # Create Recent Quick Actions Table

  1. New Tables
    - `recent_quick_actions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `organization_id` (uuid, FK to organizations)
      - `action_type` (text) - The type of action (invoice_client, schedule_client, etc.)
      - `label` (text) - Display label for the action
      - `description` (text) - Brief description
      - `raw_input` (text) - The original search text typed
      - `metadata` (jsonb) - Extra data like client name, amount, etc.
      - `use_count` (integer, default 1) - How many times this action was used
      - `last_used_at` (timestamptz) - When it was last used
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `recent_quick_actions` table
    - Add policies for authenticated users to manage their own actions

  3. Indexes
    - Index on user_id + organization_id for fast filtering
    - Index on last_used_at for sorting recents
*/

CREATE TABLE IF NOT EXISTS recent_quick_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  raw_input text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}',
  use_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recent_quick_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recent actions"
  ON recent_quick_actions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recent actions"
  ON recent_quick_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recent actions"
  ON recent_quick_actions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recent actions"
  ON recent_quick_actions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recent_quick_actions_user_org
  ON recent_quick_actions(user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_recent_quick_actions_last_used
  ON recent_quick_actions(last_used_at DESC);
