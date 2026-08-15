/*
  # Fix Missing Foreign Key Indexes

  ## Summary
  Adds covering indexes for foreign keys that lack them, improving JOIN and cascade performance.

  ## New Indexes
  1. `departure_reminders.organization_id`
  2. `equipment_inventory.created_by`
  3. `geofence_job_sessions.approved_by`
  4. `geofence_job_sessions.client_address_id`
  5. `geofence_job_sessions.schedule_event_id`
  6. `oil_changes.organization_id`
  7. `portal_messages.client_id`
  8. `portal_messages.portal_account_id`
  9. `recent_quick_actions.organization_id`
  10. `time_entry_week_locks.locked_by`
*/

CREATE INDEX IF NOT EXISTS idx_departure_reminders_organization_id ON public.departure_reminders (organization_id);
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_created_by ON public.equipment_inventory (created_by);
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_approved_by ON public.geofence_job_sessions (approved_by);
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_client_address_id ON public.geofence_job_sessions (client_address_id);
CREATE INDEX IF NOT EXISTS idx_geofence_job_sessions_schedule_event_id ON public.geofence_job_sessions (schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_oil_changes_organization_id ON public.oil_changes (organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_client_id ON public.portal_messages (client_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_portal_account_id ON public.portal_messages (portal_account_id);
CREATE INDEX IF NOT EXISTS idx_recent_quick_actions_organization_id ON public.recent_quick_actions (organization_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_week_locks_locked_by ON public.time_entry_week_locks (locked_by);
