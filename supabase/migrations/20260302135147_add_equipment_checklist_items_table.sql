/*
  # Add Equipment Checklist Items Table

  ## Purpose
  Stores per-employee, per-day equipment check state so employees can track
  which equipment items they have loaded/verified before heading to their jobs.

  ## New Tables

  ### equipment_checklist_items
  Tracks individual equipment items an employee needs to check off for a work day.
  - `id` (uuid, primary key)
  - `employee_id` (uuid, FK → auth.users) - the employee checking off items
  - `organization_id` (uuid, FK → organizations) - multi-tenant isolation
  - `schedule_event_id` (uuid, nullable FK → schedule_events) - which job the item came from
  - `equipment_name` (text) - name of the equipment item
  - `equipment_category` (text) - optional grouping (e.g., "Cleaning Supplies", "Ladders")
  - `is_checked` (boolean) - whether the employee has checked this item off
  - `checked_at` (timestamptz) - when it was checked
  - `work_date` (date) - the work day this checklist is for (for grouping/resetting)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled with policies for employee access to own records
  - Organization admins/managers can view all items in their org
*/

CREATE TABLE IF NOT EXISTS equipment_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_event_id uuid REFERENCES schedule_events(id) ON DELETE SET NULL,
  equipment_name text NOT NULL,
  equipment_category text DEFAULT '',
  is_checked boolean DEFAULT false,
  checked_at timestamptz,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own equipment checklist items"
  ON equipment_checklist_items FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert own equipment checklist items"
  ON equipment_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid() AND organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Employees can update own equipment checklist items"
  ON equipment_checklist_items FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employees can delete own equipment checklist items"
  ON equipment_checklist_items FOR DELETE
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Managers and owners can view org equipment checklist items"
  ON equipment_checklist_items FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager', 'crew_lead')
    )
  );

CREATE INDEX IF NOT EXISTS idx_equipment_checklist_items_employee_id
  ON equipment_checklist_items(employee_id);

CREATE INDEX IF NOT EXISTS idx_equipment_checklist_items_org_id
  ON equipment_checklist_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_equipment_checklist_items_work_date
  ON equipment_checklist_items(employee_id, work_date);

CREATE INDEX IF NOT EXISTS idx_equipment_checklist_items_schedule_event
  ON equipment_checklist_items(schedule_event_id);
