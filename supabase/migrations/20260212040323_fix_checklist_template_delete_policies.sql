/*
  # Fix Checklist Template Delete Policies

  1. Changes
    - Updates delete policies for checklist_templates to include 'admin' role
    - Updates delete policies for checklist_template_items to include 'admin' role
    - Ensures consistency between frontend role checks and database policies

  2. Security
    - Maintains restrictive delete access to appropriate roles only
*/

-- Fix checklist_templates delete policy
DROP POLICY IF EXISTS "Non-basic users can delete templates" ON checklist_templates;
CREATE POLICY "Non-basic users can delete templates"
  ON checklist_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_templates.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'manager')
    )
  );

-- Fix checklist_template_items delete policy
DROP POLICY IF EXISTS "Non-basic members can delete template items" ON checklist_template_items;
CREATE POLICY "Non-basic members can delete template items"
  ON checklist_template_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = checklist_template_items.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'manager')
    )
  );
