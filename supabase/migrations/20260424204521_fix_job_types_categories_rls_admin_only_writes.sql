/*
  # Restrict job_types and job_type_categories writes to admins/owners only

  ## Summary
  Previously any org member could insert, update, and delete job types and categories.
  This migration locks write operations to owners and admins only. Regular members
  (employees) retain read access but cannot modify organizational content.

  ## Changes

  ### job_types
  - DROP permissive member INSERT policy → replaced with admin-only INSERT
  - DROP permissive member UPDATE policy → replaced with admin-only UPDATE
  - Keep existing admin-only DELETE (already correct)
  - Keep SELECT open to all org members (employees still need to read job types)

  ### job_type_categories
  - DROP all permissive member write policies → replaced with admin-only versions
  - Keep SELECT open to all org members

  ## Security
  - Only owners and admins can create, edit, or delete job types and categories
  - All org members can read job types and categories (needed for scheduling, estimates, etc.)
  - Uses existing `is_org_admin()` and `is_org_manager_or_admin()` helper functions
*/

-- ============================================================
-- job_types: tighten INSERT and UPDATE to admins/owners only
-- ============================================================

DROP POLICY IF EXISTS "members_insert" ON job_types;
DROP POLICY IF EXISTS "members_update" ON job_types;

CREATE POLICY "admins_insert"
  ON job_types
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "admins_update"
  ON job_types
  FOR UPDATE
  TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- ============================================================
-- job_type_categories: tighten all writes to admins/owners only
-- ============================================================

DROP POLICY IF EXISTS "Org members can insert job_type_categories" ON job_type_categories;
DROP POLICY IF EXISTS "Org members can update job_type_categories" ON job_type_categories;
DROP POLICY IF EXISTS "Org members can delete job_type_categories" ON job_type_categories;

CREATE POLICY "admins_insert_categories"
  ON job_type_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "admins_update_categories"
  ON job_type_categories
  FOR UPDATE
  TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "admins_delete_categories"
  ON job_type_categories
  FOR DELETE
  TO authenticated
  USING (is_org_admin(organization_id));
