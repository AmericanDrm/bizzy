/*
  # Convert To-Dos to Per-User with Optional Sharing

  1. Changes
    - Make `organization_id` nullable in todos table (was required, now optional)
    - Add `is_shared_with_org` boolean field (default false) to allow users to share to-dos with organization
    - Add `client_id` field to link to-dos to clients (for pre-filling job creation)

  2. Security Updates
    - Drop all existing RLS policies on todos
    - Create new user-centric RLS policies that allow:
      - Users to view their own to-dos
      - Users to view organization to-dos that are marked as shared (is_shared_with_org = true)
      - Users to only modify/delete their own to-dos

  3. Data Migration
    - Existing to-dos remain intact with their organization_id
    - All existing to-dos default to not shared (is_shared_with_org = false)

  4. Notes
    - This enables per-user to-do lists with optional organization visibility
    - Supports pre-filling client info when converting to-dos to jobs
*/

-- Add new columns to todos table
ALTER TABLE todos
  ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS is_shared_with_org boolean DEFAULT false;

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Create index for client_id lookups
CREATE INDEX IF NOT EXISTS idx_todos_client_id ON todos(client_id);

-- Create index for shared todos queries
CREATE INDEX IF NOT EXISTS idx_todos_shared ON todos(is_shared_with_org, organization_id) WHERE is_shared_with_org = true;

-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Members can create todos" ON todos;
DROP POLICY IF EXISTS "Members can view todos" ON todos;
DROP POLICY IF EXISTS "Users can delete own todos" ON todos;
DROP POLICY IF EXISTS "Users can update own todos" ON todos;
DROP POLICY IF EXISTS "Organization members can view todos" ON todos;
DROP POLICY IF EXISTS "Organization members can insert todos" ON todos;
DROP POLICY IF EXISTS "Organization members can update todos" ON todos;
DROP POLICY IF EXISTS "Organization members can delete todos" ON todos;

-- Create new user-centric RLS policies

-- Users can view their own to-dos OR to-dos shared with their organization
CREATE POLICY "Users can view own or shared todos"
  ON todos FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      is_shared_with_org = true
      AND organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = todos.organization_id
        AND organization_members.user_id = auth.uid()
      )
    )
  );

-- Users can only insert their own to-dos
CREATE POLICY "Users can insert own todos"
  ON todos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own to-dos
CREATE POLICY "Users can update own todos v2"
  ON todos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own to-dos
CREATE POLICY "Users can delete own todos v2"
  ON todos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);