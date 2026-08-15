/*
  # Create Work Orders Table

  1. New Tables
    - `work_orders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `organization_id` (uuid, references organizations)
      - `schedule_event_id` (uuid, references schedule_events)
      - `client_id` (uuid, references clients, nullable)
      - `client_name` (text) - snapshot at creation time
      - `client_phone` (text) - snapshot at creation time
      - `job_type` (text) - snapshot of job type name
      - `scope` (text) - job scope/description
      - `notes` (text) - additional notes
      - `status` (text) - pending, in_progress, completed
      - `scheduled_date` (date) - date of the scheduled event
      - `scheduled_time` (text) - formatted start time
      - `location` (text) - job location
      - `address` (text) - full address
      - `crew_size` (integer) - number of crew members
      - `amount` (numeric) - job amount
      - `visible_fields` (jsonb) - configurable list of fields to display on sheet
      - `custom_fields` (jsonb) - user-defined custom field values
      - `arrival_notified` (boolean) - whether arrival notification was shown
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `work_orders` table
    - Policies for authenticated users scoped to organization membership
*/

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid NOT NULL,
  schedule_event_id uuid REFERENCES schedule_events(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  client_phone text DEFAULT '',
  job_type text DEFAULT '',
  scope text DEFAULT '',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  scheduled_date date,
  scheduled_time text DEFAULT '',
  location text DEFAULT '',
  address text DEFAULT '',
  crew_size integer NOT NULL DEFAULT 1,
  amount numeric DEFAULT 0,
  visible_fields jsonb DEFAULT '["client_name","client_phone","job_type","scope","notes","scheduled_date","scheduled_time","location","crew_size","amount"]'::jsonb,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  arrival_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view work orders"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = work_orders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can insert work orders"
  ON work_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = work_orders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can update work orders"
  ON work_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = work_orders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = work_orders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can delete work orders"
  ON work_orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = work_orders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_set_org_id_work_orders
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_default_organization_id();

CREATE INDEX IF NOT EXISTS idx_work_orders_user_id ON work_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_org_id ON work_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_schedule_event_id ON work_orders(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON work_orders(scheduled_date);
