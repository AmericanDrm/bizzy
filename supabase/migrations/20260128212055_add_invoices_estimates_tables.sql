/*
  # Add Invoices, Estimates, and Job Types Tables

  ## Overview
  This migration creates tables for managing invoices, estimates, job types with hourly rates, and business settings for logo storage.

  ## New Tables

  ### 1. job_types
  Stores configurable job types with default hourly rates
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Job type name (e.g., "Lawn Mowing", "Plumbing")
  - `description` (text) - Optional description
  - `hourly_rate` (decimal) - Default hourly rate for this job type
  - `is_active` (boolean) - Whether this job type is available for selection
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 2. business_settings
  Stores business configuration including logo
  - `id` (uuid, primary key) - Unique identifier
  - `logo_url` (text) - URL to business logo for invoices/estimates
  - `business_name` (text) - Business name to display
  - `business_address` (text) - Business address
  - `business_phone` (text) - Business phone
  - `business_email` (text) - Business email
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 3. invoices
  Stores invoice records
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Creator of the invoice
  - `client_id` (uuid) - Client being invoiced
  - `invoice_number` (text) - Unique invoice number
  - `status` (text) - draft, sent, paid, overdue, cancelled
  - `issue_date` (date) - Date invoice was issued
  - `due_date` (date) - Payment due date
  - `subtotal` (decimal) - Subtotal before tax
  - `tax_rate` (decimal) - Tax percentage
  - `tax_amount` (decimal) - Calculated tax amount
  - `total` (decimal) - Total amount due
  - `notes` (text) - Additional notes
  - `sent_via` (text) - email or sms
  - `sent_at` (timestamptz) - When the invoice was sent
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 4. invoice_items
  Line items for invoices
  - `id` (uuid, primary key) - Unique identifier
  - `invoice_id` (uuid) - Parent invoice
  - `job_type_id` (uuid, nullable) - Optional link to job type
  - `description` (text) - Item description
  - `quantity` (decimal) - Number of units/hours
  - `unit_price` (decimal) - Price per unit/hour
  - `total` (decimal) - Line item total
  - `created_at` (timestamptz) - Record creation timestamp

  ### 5. estimates
  Stores estimate/quote records
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Creator of the estimate
  - `client_id` (uuid) - Client for the estimate
  - `estimate_number` (text) - Unique estimate number
  - `status` (text) - draft, sent, accepted, declined, expired
  - `issue_date` (date) - Date estimate was issued
  - `valid_until` (date) - Estimate validity date
  - `subtotal` (decimal) - Subtotal before tax
  - `tax_rate` (decimal) - Tax percentage
  - `tax_amount` (decimal) - Calculated tax amount
  - `total` (decimal) - Total estimated amount
  - `notes` (text) - Additional notes
  - `sent_via` (text) - email or sms
  - `sent_at` (timestamptz) - When the estimate was sent
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 6. estimate_items
  Line items for estimates
  - `id` (uuid, primary key) - Unique identifier
  - `estimate_id` (uuid) - Parent estimate
  - `job_type_id` (uuid, nullable) - Optional link to job type
  - `description` (text) - Item description
  - `quantity` (decimal) - Number of units/hours
  - `unit_price` (decimal) - Price per unit/hour
  - `total` (decimal) - Line item total
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - RLS enabled on all tables
  - job_types: All authenticated users can view, only admins/managers can modify
  - business_settings: All authenticated users can view, only admins/managers can modify
  - invoices/estimates: All authenticated users can create and manage
  - Line items inherit access from parent invoice/estimate
*/

-- Create job_types table
CREATE TABLE IF NOT EXISTS job_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create business_settings table (single row for the business)
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text DEFAULT '',
  business_name text DEFAULT '',
  business_address text DEFAULT '',
  business_phone text DEFAULT '',
  business_email text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  subtotal numeric(10,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  notes text DEFAULT '',
  sent_via text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  job_type_id uuid REFERENCES job_types(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  estimate_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  subtotal numeric(10,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  notes text DEFAULT '',
  sent_via text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create estimate_items table
CREATE TABLE IF NOT EXISTS estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  job_type_id uuid REFERENCES job_types(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_client_id ON estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_job_types_is_active ON job_types(is_active);

-- Enable RLS
ALTER TABLE job_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_types
CREATE POLICY "All authenticated users can view active job types"
  ON job_types FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  ));

CREATE POLICY "Admins and managers can insert job types"
  ON job_types FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  ));

CREATE POLICY "Admins and managers can update job types"
  ON job_types FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  ));

CREATE POLICY "Admins and managers can delete job types"
  ON job_types FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  ));

-- RLS Policies for business_settings
CREATE POLICY "All authenticated users can view business settings"
  ON business_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can insert business settings"
  ON business_settings FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  ));

CREATE POLICY "Admins and managers can update business settings"
  ON business_settings FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  ));

-- RLS Policies for invoices
CREATE POLICY "Users can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for invoice_items
CREATE POLICY "Users can view invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id
  ));

CREATE POLICY "Users can insert invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id
  ));

CREATE POLICY "Users can update invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id
  ));

CREATE POLICY "Users can delete invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id
  ));

-- RLS Policies for estimates
CREATE POLICY "Users can view all estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert estimates"
  ON estimates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update estimates"
  ON estimates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete estimates"
  ON estimates FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for estimate_items
CREATE POLICY "Users can view estimate items"
  ON estimate_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id
  ));

CREATE POLICY "Users can insert estimate items"
  ON estimate_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id
  ));

CREATE POLICY "Users can update estimate items"
  ON estimate_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id
  ));

CREATE POLICY "Users can delete estimate items"
  ON estimate_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id
  ));

-- Insert default business settings row
INSERT INTO business_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
  year_prefix text;
BEGIN
  year_prefix := to_char(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM invoices
  WHERE invoice_number LIKE year_prefix || '%';
  RETURN year_prefix || LPAD(next_num::text, 4, '0');
END;
$$;

-- Function to generate estimate numbers
CREATE OR REPLACE FUNCTION generate_estimate_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
  year_prefix text;
BEGIN
  year_prefix := 'E' || to_char(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(estimate_number FROM 6) AS integer)), 0) + 1
  INTO next_num
  FROM estimates
  WHERE estimate_number LIKE year_prefix || '%';
  RETURN year_prefix || LPAD(next_num::text, 4, '0');
END;
$$;