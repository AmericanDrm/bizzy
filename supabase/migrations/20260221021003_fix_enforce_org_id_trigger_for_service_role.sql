/*
  # Fix enforce_user_organization_id trigger for service role operations

  1. Problem
    - The `enforce_user_organization_id()` trigger calls `auth.uid()` to look up the user's organization
    - When edge functions run with the service role key (e.g., estimate approval by unauthenticated clients),
      `auth.uid()` returns NULL, causing the trigger to raise "User is not a member of any organization"
    - This blocks estimate approvals, job auto-creation, and estimate status updates from edge functions

  2. Fix
    - Add an early return in `enforce_user_organization_id()` that skips enforcement when `auth.uid()` IS NULL
    - Service role operations bypass RLS already; the trigger should not block them
    - Normal authenticated user operations are unaffected since `auth.uid()` is always set for them

  3. Security
    - Service role key is only used server-side in edge functions, never exposed to clients
    - The trigger still enforces org isolation for all authenticated user operations
    - No changes to RLS policies
*/

CREATE OR REPLACE FUNCTION public.enforce_user_organization_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO user_org_id
  FROM organization_members
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1;

  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;

  IF NEW.organization_id IS NOT NULL AND NEW.organization_id != user_org_id THEN
    RAISE EXCEPTION 'Cannot set organization_id to an organization you do not belong to';
  END IF;

  NEW.organization_id := user_org_id;

  RETURN NEW;
END;
$function$;