/*
  # Fix Checklist Deletion Policies

  Updates RLS policies for job_checklist_items and job_checklists to use correct role names.
  
  Changes:
  - Updates delete policies to check for 'owner', 'admin', 'manager' roles instead of 'member'
  - Ensures consistency between frontend role checks and database policies
*/

-- =====================================================
-- FIX JOB_CHECKLIST_ITEMS DELETE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Non-basic users can delete checklist items" ON job_checklist_items;
CREATE POLICY "Non-basic users can delete checklist items"
  ON job_checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklist_items.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'manager')
    )
  );

-- =====================================================
-- FIX JOB_CHECKLISTS DELETE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Non-basic users can delete job checklists" ON job_checklists;
CREATE POLICY "Non-basic users can delete job checklists"
  ON job_checklists FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = job_checklists.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'manager')
    )
  );