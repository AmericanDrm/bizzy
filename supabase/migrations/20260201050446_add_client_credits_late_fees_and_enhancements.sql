/*
  # Add Client Credits, Late Fees, and Invoice Enhancements
  
  1. Client Credits
    - Add `account_balance` to clients table (positive = credit, negative = owed)
    - Add `credit_notes` to track credit history
  
  2. Late Fees
    - Add late fee configuration to invoices
    - Add `late_fee_percentage` and `late_fee_amount` fields
    - Add `late_fee_applied` flag
  
  3. Invoice Auto-increment
    - Add `invoice_sequence` table to track next invoice number per year
    - Add `estimate_sequence` table to track next estimate number per year
  
  4. Message History
    - Already exists in sent_messages table
  
  5. App Version Tracking
    - Add `app_versions` table to track what's new announcements
    - Add `user_app_version` to profiles to track last seen version
  
  6. Business Settings Enhancement
    - Add sender phone number for SMS
*/

-- Add account balance to clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'account_balance'
  ) THEN
    ALTER TABLE clients ADD COLUMN account_balance numeric DEFAULT 0;
    COMMENT ON COLUMN clients.account_balance IS 'Positive = credit, Negative = amount owed';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'credit_notes'
  ) THEN
    ALTER TABLE clients ADD COLUMN credit_notes text DEFAULT '';
  END IF;
END $$;

-- Add late fee fields to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'late_fee_percentage'
  ) THEN
    ALTER TABLE invoices ADD COLUMN late_fee_percentage numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'late_fee_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN late_fee_amount numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'late_fee_applied'
  ) THEN
    ALTER TABLE invoices ADD COLUMN late_fee_applied boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'enable_late_fees'
  ) THEN
    ALTER TABLE invoices ADD COLUMN enable_late_fees boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'grace_period_days'
  ) THEN
    ALTER TABLE invoices ADD COLUMN grace_period_days integer DEFAULT 0;
  END IF;
END $$;

-- Create invoice sequence table
CREATE TABLE IF NOT EXISTS invoice_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  year integer NOT NULL,
  last_sequence integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year)
);

ALTER TABLE invoice_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice sequences"
  ON invoice_sequence FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoice sequences"
  ON invoice_sequence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoice sequences"
  ON invoice_sequence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create estimate sequence table
CREATE TABLE IF NOT EXISTS estimate_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  year integer NOT NULL,
  last_sequence integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year)
);

ALTER TABLE estimate_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own estimate sequences"
  ON estimate_sequence FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own estimate sequences"
  ON estimate_sequence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own estimate sequences"
  ON estimate_sequence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create app versions table
CREATE TABLE IF NOT EXISTS app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number text NOT NULL UNIQUE,
  release_date date DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app versions"
  ON app_versions FOR SELECT
  TO authenticated
  USING (true);

-- Add app version tracking to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_seen_app_version'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_seen_app_version text DEFAULT '1.0.0';
  END IF;
END $$;

-- Add SMS sender number to business settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_settings' AND column_name = 'sms_sender_phone'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN sms_sender_phone text DEFAULT '';
  END IF;
END $$;

-- Add sorting preferences to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'client_sort_preference'
  ) THEN
    ALTER TABLE profiles ADD COLUMN client_sort_preference text DEFAULT 'name_asc';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'job_sort_preference'
  ) THEN
    ALTER TABLE profiles ADD COLUMN job_sort_preference text DEFAULT 'date_desc';
  END IF;
END $$;

-- Create function to get next invoice number
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_year integer;
  v_sequence integer;
  v_invoice_number text;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get or create sequence for this year
  INSERT INTO invoice_sequence (user_id, year, last_sequence)
  VALUES (p_user_id, v_year, 1)
  ON CONFLICT (user_id, year) 
  DO UPDATE SET 
    last_sequence = invoice_sequence.last_sequence + 1,
    updated_at = now()
  RETURNING last_sequence INTO v_sequence;
  
  -- Format: YYYY-0001, YYYY-0002, etc.
  v_invoice_number := v_year || '-' || LPAD(v_sequence::text, 4, '0');
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get next estimate number
CREATE OR REPLACE FUNCTION get_next_estimate_number(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_year integer;
  v_sequence integer;
  v_estimate_number text;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get or create sequence for this year
  INSERT INTO estimate_sequence (user_id, year, last_sequence)
  VALUES (p_user_id, v_year, 1)
  ON CONFLICT (user_id, year) 
  DO UPDATE SET 
    last_sequence = estimate_sequence.last_sequence + 1,
    updated_at = now()
  RETURNING last_sequence INTO v_sequence;
  
  -- Format: YYYY-0001, YYYY-0002, etc.
  v_estimate_number := v_year || '-' || LPAD(v_sequence::text, 4, '0');
  
  RETURN v_estimate_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
