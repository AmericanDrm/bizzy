/*
  # Revoke EXECUTE on SECURITY DEFINER Functions from anon Role

  All SECURITY DEFINER functions in the public schema are accessible via
  `/rest/v1/rpc/...` to the `anon` role by default. This is a security risk
  because unauthenticated callers can invoke functions that run with elevated
  (postgres/service-role) privileges.

  ## Changes
  - Revoke EXECUTE on ALL listed functions from the `anon` role
  - Revoke EXECUTE on trigger-only and internal functions from `authenticated` too
  - Keep EXECUTE on RLS helpers and user-callable RPCs for `authenticated`

  ## Categories
  1. Trigger functions (never called by users) → revoke from anon + authenticated
  2. Internal/sensitive functions (encrypt/decrypt, email confirm, etc.) → revoke from anon + authenticated
  3. RLS helper functions (used in policies) → revoke from anon only
  4. User-callable RPCs (join org, create org) → revoke from anon only
*/

-- ============================================================
-- 1. REVOKE from anon for ALL functions in the list
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.apply_organization_defaults_to_member() FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_organization_defaults_to_member(member_user_id uuid, org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_default_subscription_on_org_create() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_admin(org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_member(org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_owner(org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_email() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_message_templates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_subscription() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_organization_for_user(p_name text, p_slug text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_organization_for_user(p_user_id uuid, p_name text, p_slug text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_sms_settings_for_new_organization() FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_api_key(encrypted_key text, encryption_secret text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_ein(encrypted_ein text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_api_key(plain_key text, encryption_secret text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_ein(ein text, org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_single_default_template() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_user_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_checklist_progress(p_checklist_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_email_encryption_key() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_estimate_number(p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number(p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_org_subscription_info(p_org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_portal_client_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_portal_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(check_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_v2() FROM anon;
REVOKE EXECUTE ON FUNCTION public.initialize_default_crew_efficiency_rules(p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(check_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_manager(check_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_manager(uid uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(check_org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(check_org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(check_org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_portal_client_for(check_client_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_organization_by_code(p_join_code text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_org_id_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.provision_sms_for_new_organization() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_check_org_access(check_org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.schedule_org_lifecycle_emails(p_org_id uuid, p_owner_email text, p_owner_name text, p_org_name text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_default_pane_types() FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_starter_job_types(p_org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_break_entry_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_client_address_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_client_reminder_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_estimate_item_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_invoice_item_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_org_id_for_schedule_event_team_members() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_seed_starter_job_types() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_client_portal_settings_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_client_profile_from_history() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_departure_reminders_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_document_templates_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_location_audit_logs_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_schedule_event_line_items_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_supply_templates_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_team_notes_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_tenant_email_settings_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_work_requests_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_is_org_admin_or_owner(org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_is_org_member(org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_user_org(check_org_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_org_isolation() FROM anon;

-- ============================================================
-- 2. REVOKE from authenticated for trigger-only and internal functions
--    (these are never meant to be called directly via RPC)
-- ============================================================

-- Trigger functions - only ever fired by DB triggers, not by users
REVOKE EXECUTE ON FUNCTION public.apply_organization_defaults_to_member() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_default_subscription_on_org_create() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_email() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_message_templates() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_subscription() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_sms_settings_for_new_organization() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_default_template() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_user_organization_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_v2() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_org_id_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_sms_for_new_organization() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_pane_types() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_break_entry_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_client_address_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_client_reminder_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_estimate_item_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_invoice_item_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_org_id_for_schedule_event_team_members() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_seed_starter_job_types() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_client_portal_settings_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_client_profile_from_history() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_departure_reminders_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_document_templates_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_location_audit_logs_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_schedule_event_line_items_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_supply_templates_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_team_notes_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_tenant_email_settings_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_work_requests_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_org_isolation() FROM authenticated;

-- Internal/sensitive functions - encryption, key management, system init
REVOKE EXECUTE ON FUNCTION public.decrypt_api_key(encrypted_key text, encryption_secret text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_ein(encrypted_ein text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_api_key(plain_key text, encryption_secret text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_ein(ein text, org_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_encryption_key() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_default_crew_efficiency_rules(p_user_id uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.schedule_org_lifecycle_emails(p_org_id uuid, p_owner_email text, p_owner_name text, p_org_name text) FROM authenticated;

-- ============================================================
-- 3. Functions that remain callable by authenticated (legitimate RPCs)
--    These are intentionally kept:
--
--    apply_organization_defaults_to_member(uuid, uuid) - used during org join
--    auth_user_is_org_admin / member / owner - RLS helpers
--    auth_user_org_id - RLS helper
--    create_organization_for_user - called during signup
--    get_checklist_progress - legitimate user query
--    get_next_estimate_number / get_next_invoice_number - used by UI
--    get_org_subscription_info - used by subscription context
--    get_portal_client_id / get_portal_org_id - portal auth helpers
--    get_user_org_id / get_user_organization_id - RLS helpers
--    get_user_role - used by UI
--    is_admin / is_admin_or_manager / is_manager - RLS helpers
--    is_org_admin / is_org_manager_or_admin / is_org_member - RLS helpers
--    is_portal_client_for - portal RLS helper
--    join_organization_by_code - called when joining org via invite
--    rls_check_org_access - RLS helper
--    seed_starter_job_types - called after org creation
--    user_is_org_admin_or_owner / user_is_org_member - RLS helpers
--    validate_user_org - RLS helper
-- ============================================================
