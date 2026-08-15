/*
  # Add Missing Foreign Key Indexes

  ## Summary
  Adds covering indexes for all foreign key columns that are missing indexes.
  This resolves suboptimal query performance warnings across all affected tables.

  ## Tables Affected
  All tables with unindexed foreign key columns, including:
  - address_suggestions_cache, ai_prompt_templates, break_entries
  - checklist_template_items, checklist_templates, client_addresses
  - client_job_history, client_job_quantities, client_photos
  - client_reminders, client_unit_quantities, estimate_approval_tokens
  - estimate_items, estimates, expenses, faq_analytics
  - income, invoice_items, invoices, job_checklist_items
  - job_checklists, job_service_packages, job_supplies, job_type_defaults
  - job_types, jobs, location_audit_logs, location_tracking
  - message_templates, mileage_readings, mileage_trips, notes
  - organization_members, organizations, productivity_sessions
  - push_notifications, push_tokens, route_optimization_runs
  - route_stops, route_templates, schedule_event_team_members
  - schedule_events, sent_messages, sms_messages
  - supply_template_items, supply_templates, team_member_production_rates
  - team_notes, time_entries, todos, user_roles, vehicles
  - walkthrough_analytics, work_orders
*/

CREATE INDEX IF NOT EXISTS idx_address_suggestions_cache_org_id ON public.address_suggestions_cache(organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_org_id ON public.ai_prompt_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_break_entries_org_id ON public.break_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_break_entries_user_id ON public.break_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template_id ON public.checklist_template_items(checklist_template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_org_id ON public.checklist_template_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_created_by ON public.checklist_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_job_type_id ON public.checklist_templates(job_type_id);

CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON public.client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_org_id ON public.client_addresses(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_user_id ON public.client_addresses(user_id);

CREATE INDEX IF NOT EXISTS idx_client_job_history_org_id ON public.client_job_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_schedule_event_id ON public.client_job_history(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_service_package_id ON public.client_job_history(service_package_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_time_entry_id ON public.client_job_history(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_user_id ON public.client_job_history(user_id);

CREATE INDEX IF NOT EXISTS idx_client_job_quantities_job_type_id ON public.client_job_quantities(job_type_id);
CREATE INDEX IF NOT EXISTS idx_client_job_quantities_org_id ON public.client_job_quantities(organization_id);

CREATE INDEX IF NOT EXISTS idx_client_photos_checklist_item_id ON public.client_photos(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_deleted_by ON public.client_photos(deleted_by);
CREATE INDEX IF NOT EXISTS idx_client_photos_org_id ON public.client_photos(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_productivity_session_id ON public.client_photos(productivity_session_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_user_id ON public.client_photos(user_id);

CREATE INDEX IF NOT EXISTS idx_client_reminders_client_id ON public.client_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_client_reminders_created_by ON public.client_reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_client_reminders_job_type_id ON public.client_reminders(job_type_id);
CREATE INDEX IF NOT EXISTS idx_client_reminders_service_package_id ON public.client_reminders(service_package_id);

CREATE INDEX IF NOT EXISTS idx_client_unit_quantities_job_type_id ON public.client_unit_quantities(job_type_id);
CREATE INDEX IF NOT EXISTS idx_client_unit_quantities_org_id ON public.client_unit_quantities(organization_id);

CREATE INDEX IF NOT EXISTS idx_estimate_approval_tokens_estimate_id ON public.estimate_approval_tokens(estimate_id);

CREATE INDEX IF NOT EXISTS idx_estimate_items_job_type_id ON public.estimate_items(job_type_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_org_id ON public.estimate_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_estimates_client_id ON public.estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_estimates_org_id ON public.estimates(organization_id);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON public.estimates(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_org_id ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_parent_expense_id ON public.expenses(parent_expense_id);

CREATE INDEX IF NOT EXISTS idx_faq_analytics_user_id ON public.faq_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_income_client_id ON public.income(client_id);
CREATE INDEX IF NOT EXISTS idx_income_job_id ON public.income(job_id);
CREATE INDEX IF NOT EXISTS idx_income_org_id ON public.income(organization_id);
CREATE INDEX IF NOT EXISTS idx_income_user_id ON public.income(user_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_job_type_id ON public.invoice_items(job_type_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_org_id ON public.invoice_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);

CREATE INDEX IF NOT EXISTS idx_job_checklist_items_completed_by ON public.job_checklist_items(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_created_by ON public.job_checklist_items(created_by);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_org_id ON public.job_checklist_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_job_checklists_created_by ON public.job_checklists(created_by);
CREATE INDEX IF NOT EXISTS idx_job_checklists_job_id ON public.job_checklists(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checklists_note_id ON public.job_checklists(note_id);

CREATE INDEX IF NOT EXISTS idx_job_service_packages_org_id ON public.job_service_packages(organization_id);

CREATE INDEX IF NOT EXISTS idx_job_supplies_created_by ON public.job_supplies(created_by);
CREATE INDEX IF NOT EXISTS idx_job_supplies_job_id ON public.job_supplies(job_id);
CREATE INDEX IF NOT EXISTS idx_job_supplies_note_id ON public.job_supplies(note_id);

CREATE INDEX IF NOT EXISTS idx_job_type_defaults_job_type_id ON public.job_type_defaults(job_type_id);
CREATE INDEX IF NOT EXISTS idx_job_type_defaults_org_id ON public.job_type_defaults(organization_id);

CREATE INDEX IF NOT EXISTS idx_job_types_org_id ON public.job_types(organization_id);

CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_estimate_id ON public.jobs(estimate_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON public.jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_location_audit_logs_related_client_id ON public.location_audit_logs(related_client_id);
CREATE INDEX IF NOT EXISTS idx_location_audit_logs_related_schedule_id ON public.location_audit_logs(related_schedule_id);

CREATE INDEX IF NOT EXISTS idx_location_tracking_schedule_event_id ON public.location_tracking(schedule_event_id);

CREATE INDEX IF NOT EXISTS idx_message_templates_org_id ON public.message_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_mileage_readings_org_id ON public.mileage_readings(organization_id);
CREATE INDEX IF NOT EXISTS idx_mileage_readings_user_id ON public.mileage_readings(user_id);

CREATE INDEX IF NOT EXISTS idx_mileage_trips_org_id ON public.mileage_trips(organization_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_time_entry_id ON public.mileage_trips(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_user_id ON public.mileage_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_vehicle_id ON public.mileage_trips(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_notes_client_id ON public.notes(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_org_id ON public.notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

CREATE INDEX IF NOT EXISTS idx_productivity_sessions_org_id ON public.productivity_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_schedule_event_id ON public.productivity_sessions(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_time_entry_id ON public.productivity_sessions(time_entry_id);

CREATE INDEX IF NOT EXISTS idx_push_notifications_org_id ON public.push_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON public.push_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_org_id ON public.push_tokens(organization_id);

CREATE INDEX IF NOT EXISTS idx_route_optimization_runs_user_id ON public.route_optimization_runs(user_id);

CREATE INDEX IF NOT EXISTS idx_route_stops_client_address_id ON public.route_stops(client_address_id);

CREATE INDEX IF NOT EXISTS idx_route_templates_assigned_to ON public.route_templates(assigned_to);

CREATE INDEX IF NOT EXISTS idx_schedule_event_team_members_member_id ON public.schedule_event_team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_schedule_event_team_members_org_id ON public.schedule_event_team_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_schedule_events_assigned_to ON public.schedule_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_schedule_events_client_id ON public.schedule_events(client_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_converted_from_estimate_id ON public.schedule_events(converted_from_estimate_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_estimate_id ON public.schedule_events(estimate_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job_id ON public.schedule_events(job_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job_type_id ON public.schedule_events(job_type_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_org_id ON public.schedule_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_parent_event_id ON public.schedule_events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_service_package_id ON public.schedule_events(service_package_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_user_id ON public.schedule_events(user_id);

CREATE INDEX IF NOT EXISTS idx_sent_messages_client_id ON public.sent_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_job_id ON public.sent_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_org_id ON public.sent_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_reminder_id ON public.sent_messages(reminder_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_schedule_event_id ON public.sent_messages(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_user_id ON public.sent_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_sms_messages_client_id ON public.sms_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_org_id ON public.sms_messages(organization_id);

CREATE INDEX IF NOT EXISTS idx_supply_template_items_org_id ON public.supply_template_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_supply_template_items_template_id ON public.supply_template_items(template_id);

CREATE INDEX IF NOT EXISTS idx_supply_templates_created_by ON public.supply_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_supply_templates_org_id ON public.supply_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_team_member_production_rates_org_id ON public.team_member_production_rates(organization_id);

CREATE INDEX IF NOT EXISTS idx_team_notes_author_id ON public.team_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_org_id ON public.team_notes(organization_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_vehicle_id ON public.time_entries(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_todos_org_id ON public.todos(organization_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON public.user_roles(assigned_by);

CREATE INDEX IF NOT EXISTS idx_vehicles_org_id ON public.vehicles(organization_id);

CREATE INDEX IF NOT EXISTS idx_walkthrough_analytics_user_id ON public.walkthrough_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_schedule_event_id ON public.work_orders(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_user_id ON public.work_orders(user_id);
