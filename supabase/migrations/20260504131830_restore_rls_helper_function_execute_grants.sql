/*
  # Restore EXECUTE grants on RLS helper functions for authenticated role

  ## Summary
  The previous migration over-revoked EXECUTE on functions that are called
  within RLS policy expressions. When Postgres evaluates RLS policies for an
  authenticated user, it runs those policy expressions *as that user*, so the
  authenticated role must have EXECUTE on any function referenced inside a
  policy USING or WITH CHECK clause.

  Restoring EXECUTE on the 6 active RLS helpers:
  - is_org_member(uuid)
  - is_org_admin(uuid)
  - is_org_manager_or_admin(uuid)
  - get_portal_client_id()
  - get_portal_org_id()
  - is_portal_client_for(uuid)

  The 14 dead/redundant helpers (auth_user_is_org_admin, is_admin, etc.) remain
  revoked since they are not referenced in any RLS policy or app code.
*/

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_manager_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_portal_client_for(uuid) TO authenticated;
