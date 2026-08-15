/*
  # Enhanced Messaging and Reminders System

  1. New Tables
    - `client_reminders` - Scheduled reminders for clients at custom intervals
    - `organization_communication_settings` - Organization-level email/SMS configuration
    
  2. Enhanced Tables
    - `message_templates` - Add delivery_method (sms/email/both) and email-specific fields
    - `sent_messages` - Add delivery_method and email subject tracking
    
  3. Features
    - Custom reminder intervals (days, weeks, months before/after events)
    - Separate SMS and email message templates
    - Organization-level sender configuration (phone/email)
    - Option to use owner's contact or organization default
    - Support for message preview before sending
    
  4. Security
    - Enable RLS on all new tables
    - Appropriate member-level access policies
*/

-- =====================================================
-- PART 1: ORGANIZATION COMMUNICATION SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS organization_communication_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Sender Configuration
  use_owner_contacts boolean DEFAULT false,
  default_sms_phone text,
  default_email_address text,
  default_email_from_name text,
  
  -- Email Configuration
  email_signature text,
  email_logo_url text,
  
  -- SMS Configuration
  sms_provider text DEFAULT 'twilio',
  sms_enabled boolean DEFAULT false,
  
  -- Email Provider Configuration
  email_enabled boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id)
);

ALTER TABLE organization_communication_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org communication settings"
  ON organization_communication_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_communication_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Owners and admins can update org communication settings"
  ON organization_communication_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_communication_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_communication_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can insert org communication settings"
  ON organization_communication_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_communication_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_org_comm_settings_org_id 
  ON organization_communication_settings(organization_id);

-- =====================================================
-- PART 2: ENHANCE MESSAGE TEMPLATES
-- =====================================================

-- Add new columns to message_templates
DO $$
BEGIN
  -- Add delivery_method column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_templates' AND column_name = 'delivery_method'
  ) THEN
    ALTER TABLE message_templates 
    ADD COLUMN delivery_method text DEFAULT 'sms' CHECK (delivery_method IN ('sms', 'email', 'both'));
  END IF;

  -- Add email_subject column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_templates' AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE message_templates 
    ADD COLUMN email_subject text;
  END IF;

  -- Add email_body column (can be HTML)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_templates' AND column_name = 'email_body'
  ) THEN
    ALTER TABLE message_templates 
    ADD COLUMN email_body text;
  END IF;

  -- Add template_name for better organization
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_templates' AND column_name = 'template_name'
  ) THEN
    ALTER TABLE message_templates 
    ADD COLUMN template_name text;
  END IF;
END $$;

-- =====================================================
-- PART 3: CLIENT REMINDERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS client_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Reminder Configuration
  reminder_type text NOT NULL CHECK (reminder_type IN ('before_service', 'after_service', 'follow_up', 'custom')),
  interval_value integer NOT NULL DEFAULT 1,
  interval_unit text NOT NULL DEFAULT 'days' CHECK (interval_unit IN ('hours', 'days', 'weeks', 'months', 'years')),
  timing text NOT NULL DEFAULT 'before' CHECK (timing IN ('before', 'after')),
  
  -- Message Content
  delivery_method text NOT NULL DEFAULT 'sms' CHECK (delivery_method IN ('sms', 'email', 'both')),
  sms_message text,
  email_subject text,
  email_body text,
  
  -- Association
  job_type_id uuid REFERENCES job_types(id) ON DELETE SET NULL,
  service_package_id uuid REFERENCES job_service_packages(id) ON DELETE SET NULL,
  
  -- Scheduling
  is_active boolean DEFAULT true,
  last_sent_at timestamptz,
  next_send_date timestamptz,
  
  -- Reference
  reference_type text CHECK (reference_type IN ('appointment', 'service', 'invoice', 'estimate')),
  
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view client reminders"
  ON client_reminders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_reminders.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can create client reminders"
  ON client_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_reminders.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can update client reminders"
  ON client_reminders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_reminders.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_reminders.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Owners and admins can delete client reminders"
  ON client_reminders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = client_reminders.organization_id
      AND organization_members.user_id = (select auth.uid())
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_client_reminders_org_id 
  ON client_reminders(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_reminders_client_id 
  ON client_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_client_reminders_next_send 
  ON client_reminders(next_send_date) WHERE is_active = true;

-- =====================================================
-- PART 4: ENHANCE SENT_MESSAGES TABLE
-- =====================================================

DO $$
BEGIN
  -- Add delivery_method column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'delivery_method'
  ) THEN
    ALTER TABLE sent_messages 
    ADD COLUMN delivery_method text DEFAULT 'sms' CHECK (delivery_method IN ('sms', 'email'));
  END IF;

  -- Add email_subject column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE sent_messages 
    ADD COLUMN email_subject text;
  END IF;

  -- Add sender info
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'sent_from_phone'
  ) THEN
    ALTER TABLE sent_messages 
    ADD COLUMN sent_from_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'sent_from_email'
  ) THEN
    ALTER TABLE sent_messages 
    ADD COLUMN sent_from_email text;
  END IF;

  -- Add delivery status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'delivery_status'
  ) THEN
    ALTER TABLE sent_messages 
    ADD COLUMN delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed'));
  END IF;

  -- Add reminder reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'reminder_id'
  ) THEN
    ALTER TABLE sent_messages 
    ADD COLUMN reminder_id uuid REFERENCES client_reminders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- PART 5: TRIGGERS FOR UPDATED_AT
-- =====================================================

DROP TRIGGER IF EXISTS update_org_comm_settings_updated_at ON organization_communication_settings;
CREATE TRIGGER update_org_comm_settings_updated_at
  BEFORE UPDATE ON organization_communication_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_reminders_updated_at ON client_reminders;
CREATE TRIGGER update_client_reminders_updated_at
  BEFORE UPDATE ON client_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 6: AUTOMATIC ORG_ID TRIGGER FOR CLIENT REMINDERS
-- =====================================================

CREATE OR REPLACE FUNCTION set_client_reminder_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set organization_id from the client
  IF NEW.organization_id IS NULL THEN
    SELECT clients.organization_id INTO NEW.organization_id
    FROM clients
    WHERE clients.id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_client_reminder_org_id_trigger ON client_reminders;
CREATE TRIGGER set_client_reminder_org_id_trigger
  BEFORE INSERT ON client_reminders
  FOR EACH ROW
  EXECUTE FUNCTION set_client_reminder_org_id();