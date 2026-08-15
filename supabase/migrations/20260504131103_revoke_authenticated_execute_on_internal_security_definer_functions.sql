/*
  # Revoke authenticated EXECUTE on internal SECURITY DEFINER functions

  ## Summary
  Fixes 29 security advisor warnings by revoking direct RPC access from the
  `authenticated` role on functions that are either:
  - RLS policy helpers (called only by the database engine during row checks), or
  - Dead code / redundant helpers superseded by active equivalents.

  These functions KEEP their SECURITY DEFINER attribute because they read from
  `organization_members` (which has RLS) and need elevated access. We are only
  removing the ability for signed-in users to call them directly via
  `/rest/v1/rpc/<function_name>`.

  ## Functions affected

  ### RLS-only helpers (database engine calls these, not users)
  - is_org_member(uuid)
  - is_org_admin(uuid)
  - is_org_manager_or_admin(uuid)
  - get_portal_client_id()
  - get_portal_org_id()
  - is_portal_client_for(uuid)

  ### Dead code / redundant helpers (not used in RLS or app code)
  - auth_user_is_org_admin(uuid)
  - auth_user_is_org_member(uuid)
  - auth_user_is_org_owner(uuid)
  - auth_user_org_id()
  - validate_user_org(uuid)
  - rls_check_org_access(uuid)
  - user_is_org_admin_or_owner(uuid)
  - user_is_org_member(uuid)
  - get_user_org_id()
  - get_user_organization_id()
  - get_user_role(uuid)
  - is_admin(uuid)
  - is_admin_or_manager(uuid)
  - is_manager(uuid)

  ## Functions intentionally left unchanged (users legitimately call these)
  - create_organization_for_user — called at signup
  - join_organization_by_code — called when employees join
  - get_org_subscription_info — called by SubscriptionContext
  - apply_organization_defaults_to_member(uuid, uuid) — called during org join
  - seed_starter_job_types — called post-org-creation
  - get_checklist_progress — user query
  - get_next_invoice_number — used in invoice creation
  - get_next_estimate_number — used in estimate creation
*/

-- RLS helper functions — revoke direct user access
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_portal_client_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_portal_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_portal_client_for(uuid) FROM authenticated;

-- Dead / redundant helpers — revoke direct user access
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_member(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_owner(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_user_org(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_check_org_access(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.user_is_org_admin_or_owner(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.user_is_org_member(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_organization_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_manager(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM authenticated;
