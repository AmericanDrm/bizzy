/*
  # Fix RLS Helper Functions to Prevent Infinite Recursion
  
  The is_org_admin() and is_org_member() helper functions were causing infinite recursion
  when used in RLS policies on the organization_members table because:
  
  1. The functions call auth.uid() directly
  2. The functions query organization_members table
  3. The organization_members RLS policies call these same functions
  4. This creates an infinite loop
  
  ## Solution
  
  Wrap auth.uid() calls with (select auth.uid()) to ensure they are evaluated once
  and cached, preventing the recursive evaluation issue.
*/

-- Drop and recreate is_org_member function with optimized auth.uid() usage
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN (select auth.uid()) IS NULL THEN false
    WHEN check_org_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = check_org_id
      AND user_id = (select auth.uid())
    )
  END;
$$;

-- Drop and recreate is_org_admin function with optimized auth.uid() usage
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN (select auth.uid()) IS NULL THEN false
    WHEN check_org_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = check_org_id
      AND user_id = (select auth.uid())
      AND role IN ('owner', 'admin')
    )
  END;
$$;
