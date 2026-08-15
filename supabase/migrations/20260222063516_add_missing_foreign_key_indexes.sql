/*
  # Add Missing Foreign Key Indexes

  1. New Indexes
    - `appointment_reminders.client_id` - FK to clients
    - `checklist_item_photos.added_by` - FK to auth.users
    - `checklist_template_items.checklist_template_id` - FK to checklist_templates
    - `client_work_requests.reviewed_by` - FK to auth.users
    - `location_audit_logs.organization_id` - FK to organizations
    - `location_audit_logs.time_entry_id` - FK to time_entries
    - `location_audit_logs.user_id` - FK to auth.users
    - `organization_subscriptions.plan_id` - FK to subscription_plans
    - `route_optimization_runs.organization_id` - FK to organizations
    - `route_stops.client_id` - FK to clients
    - `route_stops.route_template_id` - FK to route_templates
    - `route_templates.created_by` - FK to auth.users
    - `todos.client_id` - FK to clients

  2. Important Notes
    - All indexes are created with IF NOT EXISTS to prevent errors
    - These indexes improve JOIN and DELETE performance on foreign key relationships
    - Without these indexes, cascading deletes and JOIN queries scan entire tables
*/

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_client_id
  ON public.appointment_reminders (client_id);

CREATE INDEX IF NOT EXISTS idx_checklist_item_photos_added_by
  ON public.checklist_item_photos (added_by);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_checklist_template_id
  ON public.checklist_template_items (checklist_template_id);

CREATE INDEX IF NOT EXISTS idx_client_work_requests_reviewed_by
  ON public.client_work_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_location_audit_logs_organization_id
  ON public.location_audit_logs (organization_id);

CREATE INDEX IF NOT EXISTS idx_location_audit_logs_time_entry_id
  ON public.location_audit_logs (time_entry_id);

CREATE INDEX IF NOT EXISTS idx_location_audit_logs_user_id
  ON public.location_audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_plan_id
  ON public.organization_subscriptions (plan_id);

CREATE INDEX IF NOT EXISTS idx_route_optimization_runs_organization_id
  ON public.route_optimization_runs (organization_id);

CREATE INDEX IF NOT EXISTS idx_route_stops_client_id
  ON public.route_stops (client_id);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_template_id
  ON public.route_stops (route_template_id);

CREATE INDEX IF NOT EXISTS idx_route_templates_created_by
  ON public.route_templates (created_by);

CREATE INDEX IF NOT EXISTS idx_todos_client_id
  ON public.todos (client_id);
