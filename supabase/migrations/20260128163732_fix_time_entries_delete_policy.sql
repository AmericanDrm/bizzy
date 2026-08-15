/*
  # Fix time entries delete policy
  
  1. Changes
    - Drop conflicting delete policies
    - Create single unified delete policy allowing users to delete own entries

  2. Security
    - Users can delete their own time entries
    - Admins and managers can delete any entries
*/

DROP POLICY IF EXISTS "Users can delete own time entries or admins can delete all" ON time_entries;
DROP POLICY IF EXISTS "Only admins and managers can delete time entries" ON time_entries;

CREATE POLICY "Users can delete own time entries"
  ON time_entries
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );