/*
  # Create Schedule Event Line Items Table

  This migration adds support for multiple line items per scheduled event,
  allowing users to combine services (e.g., Window Cleaning + Gutter Cleaning)
  in a single job.

  1. New Tables
    - `schedule_event_line_items`
      - `id` (uuid, primary key)
      - `schedule_event_id` (uuid, foreign key to schedule_events)
      - `job_type_id` (uuid, foreign key to job_types)
      - `description` (text, optional custom description)
      - `quantity` (numeric, unit count based on job type)
      - `unit_price` (numeric, price per unit)
      - `service_scope` (text, for pane-based jobs: full_service/exterior_only/interior_only)
      - `pane_details` (jsonb, stores pane counts by type for window jobs)
      - `total` (numeric, calculated line item total)
      - `display_order` (integer, for ordering line items)
      - `organization_id` (uuid, for multi-tenant isolation)
      - `created_at` / `updated_at` timestamps

  2. Changes to Existing Tables
    - Adds `default_service_scope` to `clients` table for persisting client preferences

  3. Security
    - Enable RLS on schedule_event_line_items
    - Policies for organization members to manage their own line items
*/

-- Create schedule_event_line_items table
CREATE TABLE IF NOT EXISTS schedule_event_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_event_id uuid NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
  job_type_id uuid REFERENCES job_types(id) ON DELETE SET NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  service_scope text DEFAULT 'full_service' CHECK (service_scope IN ('full_service', 'exterior_only', 'interior_only')),
  pane_details jsonb,
  total numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add default_service_scope to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'default_service_scope'
  ) THEN
    ALTER TABLE clients ADD COLUMN default_service_scope text DEFAULT 'full_service' 
      CHECK (default_service_scope IN ('full_service', 'exterior_only', 'interior_only'));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_event_line_items_event_id 
  ON schedule_event_line_items(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_event_line_items_org_id 
  ON schedule_event_line_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_event_line_items_job_type 
  ON schedule_event_line_items(job_type_id);

-- Enable RLS
ALTER TABLE schedule_event_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_event_line_items
CREATE POLICY "Organization members can view line items"
  ON schedule_event_line_items
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can insert line items"
  ON schedule_event_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can update line items"
  ON schedule_event_line_items
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can delete line items"
  ON schedule_event_line_items
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_schedule_event_line_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_schedule_event_line_items_updated_at ON schedule_event_line_items;
CREATE TRIGGER set_schedule_event_line_items_updated_at
  BEFORE UPDATE ON schedule_event_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_schedule_event_line_items_updated_at();
