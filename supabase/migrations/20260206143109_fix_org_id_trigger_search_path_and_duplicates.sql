/*
  # Fix Organization ID Trigger - Search Path and Duplicate Triggers

  1. Problem
    - The `set_default_organization_id()` function has `search_path=""` (empty)
    - This causes "relation organization_members does not exist" errors on every insert
    - Every table has duplicate triggers (`trg_set_org_id` and `trigger_set_org_id`)

  2. Solution
    - Recreate the function with `SET search_path = public` so it can find organization_members
    - Drop duplicate `trigger_set_org_id` triggers from all affected tables
    - Keep only `trg_set_org_id` (and `trg_set_org_id_work_orders` for work_orders)

  3. Affected Tables
    - clients, jobs, job_types, schedule_events, time_entries, notes, todos,
      invoices, estimates, income, expenses, message_templates, client_photos,
      sent_messages, job_service_packages, client_job_history, productivity_sessions,
      location_tracking, detected_locations, clock_out_prompts, work_orders
*/

CREATE OR REPLACE FUNCTION set_default_organization_id()
RETURNS TRIGGER AS $$
DECLARE
  resolved_org_id uuid;
BEGIN
  SELECT om.organization_id INTO resolved_org_id
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
  ORDER BY om.joined_at ASC
  LIMIT 1;

  IF resolved_org_id IS NOT NULL THEN
    NEW.organization_id := resolved_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_set_org_id ON clients;
DROP TRIGGER IF EXISTS trigger_set_org_id ON jobs;
DROP TRIGGER IF EXISTS trigger_set_org_id ON job_types;
DROP TRIGGER IF EXISTS trigger_set_org_id ON schedule_events;
DROP TRIGGER IF EXISTS trigger_set_org_id ON time_entries;
DROP TRIGGER IF EXISTS trigger_set_org_id ON notes;
DROP TRIGGER IF EXISTS trigger_set_org_id ON todos;
DROP TRIGGER IF EXISTS trigger_set_org_id ON invoices;
DROP TRIGGER IF EXISTS trigger_set_org_id ON estimates;
DROP TRIGGER IF EXISTS trigger_set_org_id ON income;
DROP TRIGGER IF EXISTS trigger_set_org_id ON expenses;
DROP TRIGGER IF EXISTS trigger_set_org_id ON message_templates;
DROP TRIGGER IF EXISTS trigger_set_org_id ON client_photos;
DROP TRIGGER IF EXISTS trigger_set_org_id ON sent_messages;
DROP TRIGGER IF EXISTS trigger_set_org_id ON job_service_packages;
DROP TRIGGER IF EXISTS trigger_set_org_id ON client_job_history;
DROP TRIGGER IF EXISTS trigger_set_org_id ON productivity_sessions;
DROP TRIGGER IF EXISTS trigger_set_org_id ON location_tracking;
DROP TRIGGER IF EXISTS trigger_set_org_id ON detected_locations;
DROP TRIGGER IF EXISTS trigger_set_org_id ON clock_out_prompts;
DROP TRIGGER IF EXISTS trigger_set_org_id ON work_orders;