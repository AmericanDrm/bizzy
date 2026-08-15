/*
  # Revoke PUBLIC EXECUTE on All SECURITY DEFINER Functions

  PostgreSQL grants EXECUTE to PUBLIC by default on all functions. Since `anon`
  and `authenticated` roles inherit from PUBLIC, revoking from those roles
  individually is insufficient — the PUBLIC grant must be revoked first.

  This migration revokes EXECUTE on all SECURITY DEFINER functions from PUBLIC,
  then selectively re-grants to `authenticated` for functions that are
  legitimately called by signed-in users via RPC.

  ## Strategy
  1. REVOKE EXECUTE ... FROM PUBLIC — removes the default open grant
  2. GRANT EXECUTE back to `authenticated` only for user-facing RPCs and RLS helpers
  3. Trigger-only and internal functions remain inaccessible via REST API
*/

-- ============================================================
-- REVOKE from PUBLIC (covers anon + authenticated inheritance)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.apply_organization_defaults_to_member() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_organization_defaults_to_member(member_user_id uuid, org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_default_subscription_on_org_create() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_admin(org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_member(org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_is_org_owner(org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_email() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_message_templates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_subscription() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_organization_for_user(p_name text, p_slug text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_organization_for_user(p_user_id uuid, p_name text, p_slug text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_sms_settings_for_new_organization() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_api_key(encrypted_key text, encryption_secret text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_ein(encrypted_ein text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_api_key(plain_key text, encryption_secret text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_ein(ein text, org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_single_default_template() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_user_organization_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_checklist_progress(p_checklist_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_email_encryption_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_estimate_number(p_user_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number(p_user_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_subscription_info(p_org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_client_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portal_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_organization_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(check_user_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_v2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initialize_default_crew_efficiency_rules(p_user_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(check_user_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_manager(check_user_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_manager(uid uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(check_org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(check_org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(check_org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_portal_client_for(check_client_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_organization_by_code(p_join_code text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_org_id_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.provision_sms_for_new_organization() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_check_org_access(check_org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.schedule_org_lifecycle_emails(p_org_id uuid, p_owner_email text, p_owner_name text, p_org_name text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_pane_types() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_starter_job_types(p_org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_break_entry_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_client_address_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_client_reminder_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_estimate_item_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_invoice_item_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_org_id_for_schedule_event_team_members() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_seed_starter_job_types() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_client_portal_settings_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_client_profile_from_history() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_departure_reminders_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_document_templates_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_location_audit_logs_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_schedule_event_line_items_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_supply_templates_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_team_notes_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_tenant_email_settings_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_work_requests_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_org_admin_or_owner(org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_org_member(org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_user_org(check_org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_org_isolation() FROM PUBLIC;

-- ============================================================
-- Re-grant to authenticated for legitimate user-facing RPCs
-- and RLS helper functions (needed for RLS policy evaluation)
-- ============================================================

-- RLS helpers (called internally by RLS policies during query execution)
GRANT EXECUTE ON FUNCTION public.auth_user_is_org_admin(org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_is_org_member(org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_is_org_owner(org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(check_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(check_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(uid uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(check_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_manager_or_admin(check_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(check_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_portal_client_for(check_client_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_check_org_access(check_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_org_admin_or_owner(org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_org_member(org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_user_org(check_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_org_id() TO authenticated;

-- User-facing RPCs called from the application
GRANT EXECUTE ON FUNCTION public.apply_organization_defaults_to_member(member_user_id uuid, org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_for_user(p_name text, p_slug text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_for_user(p_user_id uuid, p_name text, p_slug text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_checklist_progress(p_checklist_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_estimate_number(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_subscription_info(p_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(check_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_organization_by_code(p_join_code text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_starter_job_types(p_org_id uuid) TO authenticated;
