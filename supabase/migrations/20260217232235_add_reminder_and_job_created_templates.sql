/*
  # Add Reminder and Job Created Message Templates

  1. Changes
    - Drops and recreates the valid_template_type check constraint to allow new types
    - Makes message_text nullable (email-only templates have no SMS text)
    - Adds scheduling columns: send_automatically, send_interval_value, send_interval_unit, send_interval_timing
    - Seeds 'reminder' and 'job_created' templates for all existing organizations
    - Updates create_organization_for_user to include new template types

  2. New Template Types
    - `reminder` (sms + email) - Generic reminder, send manually or on a schedule
    - `job_created` (sms + email) - Sent when a job is created for a client

  3. Security
    - Trigger disabled during seeding then re-enabled
    - Existing RLS policies cover new columns automatically
*/

-- Step 1: Expand the template_type check constraint
ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS valid_template_type;
ALTER TABLE message_templates ADD CONSTRAINT valid_template_type
  CHECK (template_type = ANY (ARRAY[
    'day_of', 'on_way', 'follow_up',
    'invoice_email', 'estimate_email',
    'reminder', 'job_created'
  ]));

-- Step 2: Make message_text nullable so email-only templates don't need it
ALTER TABLE message_templates ALTER COLUMN message_text DROP NOT NULL;

-- Step 3: Add scheduling columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_templates' AND column_name = 'send_automatically'
  ) THEN
    ALTER TABLE message_templates ADD COLUMN send_automatically boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_templates' AND column_name = 'send_interval_value'
  ) THEN
    ALTER TABLE message_templates ADD COLUMN send_interval_value integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_templates' AND column_name = 'send_interval_unit'
  ) THEN
    ALTER TABLE message_templates ADD COLUMN send_interval_unit text DEFAULT 'days';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_templates' AND column_name = 'send_interval_timing'
  ) THEN
    ALTER TABLE message_templates ADD COLUMN send_interval_timing text DEFAULT 'before';
  END IF;
END $$;

-- Step 4: Disable the org_id enforcement trigger during seeding
ALTER TABLE message_templates DISABLE TRIGGER enforce_org_id_trigger;

-- Step 5: Seed templates for all existing organizations
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT o.id AS org_id, o.owner_id AS user_id
    FROM organizations o
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM message_templates
      WHERE organization_id = rec.org_id AND template_type = 'reminder' AND delivery_method = 'sms'
    ) THEN
      INSERT INTO message_templates (
        user_id, organization_id, template_type, template_name,
        message_text, delivery_method, is_active,
        send_automatically, send_interval_value, send_interval_unit, send_interval_timing
      ) VALUES (
        rec.user_id, rec.org_id, 'reminder', 'Reminder (SMS)',
        'Hi {client_name}, this is a reminder about your upcoming service on {date} at {time}. Please let us know if you have any questions!',
        'sms', true, false, 1, 'days', 'before'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM message_templates
      WHERE organization_id = rec.org_id AND template_type = 'reminder' AND delivery_method = 'email'
    ) THEN
      INSERT INTO message_templates (
        user_id, organization_id, template_type, template_name,
        message_text, email_subject, email_body, delivery_method, is_active,
        send_automatically, send_interval_value, send_interval_unit, send_interval_timing
      ) VALUES (
        rec.user_id, rec.org_id, 'reminder', 'Reminder (Email)',
        NULL,
        'Reminder: Your Upcoming Service — {business_name}',
        '<p>Hi {client_name},</p><p>This is a friendly reminder about your upcoming service scheduled for <strong>{date}</strong> at <strong>{time}</strong>.</p><p>If you need to reschedule or have any questions, please don''t hesitate to reach out.</p><p>Best regards,<br>{business_name}</p>',
        'email', true, false, 1, 'days', 'before'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM message_templates
      WHERE organization_id = rec.org_id AND template_type = 'job_created' AND delivery_method = 'sms'
    ) THEN
      INSERT INTO message_templates (
        user_id, organization_id, template_type, template_name,
        message_text, delivery_method, is_active,
        send_automatically, send_interval_value, send_interval_unit, send_interval_timing
      ) VALUES (
        rec.user_id, rec.org_id, 'job_created', 'Job Created (SMS)',
        'Hi {client_name}, a new job has been scheduled for you: {job_title} on {date} at {time}. We look forward to seeing you!',
        'sms', true, false, 0, 'days', 'after'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM message_templates
      WHERE organization_id = rec.org_id AND template_type = 'job_created' AND delivery_method = 'email'
    ) THEN
      INSERT INTO message_templates (
        user_id, organization_id, template_type, template_name,
        message_text, email_subject, email_body, delivery_method, is_active,
        send_automatically, send_interval_value, send_interval_unit, send_interval_timing
      ) VALUES (
        rec.user_id, rec.org_id, 'job_created', 'Job Created (Email)',
        NULL,
        'Your Job Has Been Scheduled — {business_name}',
        '<p>Hi {client_name},</p><p>Great news! A new job has been scheduled for you:</p><p><strong>Service:</strong> {job_title}<br><strong>Date:</strong> {date}<br><strong>Time:</strong> {time}</p><p>If you have any questions or need to make changes, please contact us.</p><p>Best regards,<br>{business_name}</p>',
        'email', true, false, 0, 'days', 'after'
      );
    END IF;

  END LOOP;
END $$;

-- Step 6: Re-enable the trigger
ALTER TABLE message_templates ENABLE TRIGGER enforce_org_id_trigger;

-- Step 7: Update create_organization_for_user to include all template types
CREATE OR REPLACE FUNCTION create_organization_for_user(
  p_user_id uuid,
  p_name text,
  p_slug text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_result json;
BEGIN
  v_user_id := p_user_id;

  INSERT INTO organizations (name, slug, owner_id)
  VALUES (TRIM(p_name), TRIM(p_slug), v_user_id)
  RETURNING id INTO v_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  INSERT INTO message_templates (user_id, organization_id, template_type, template_name, message_text, delivery_method, is_active)
  VALUES
    (v_user_id, v_org_id, 'day_of',    'Day of Appointment', 'Hi {client_name}! This is a reminder about your appointment today at {time} for {job_title}. Looking forward to seeing you!', 'sms', true),
    (v_user_id, v_org_id, 'on_way',    'On the Way',         'Hi {client_name}! I''m on my way to your location for {job_title}. I should arrive in approximately 15 minutes.', 'sms', true),
    (v_user_id, v_org_id, 'follow_up', 'Follow Up',          'Hi {client_name}! Thank you for choosing our services. If you have any questions or concerns about the work completed, please don''t hesitate to reach out!', 'sms', true);

  INSERT INTO message_templates (
    user_id, organization_id, template_type, template_name,
    delivery_method, message_text, email_subject, email_body, is_active
  )
  VALUES
    (
      v_user_id, v_org_id, 'invoice_email', 'Invoice Email', 'email', NULL,
      'Invoice #{invoice_number} from {business_name}',
      '<p>Hello {client_name},</p><p>Thank you for your business! Please find your invoice attached.</p><p><strong>Invoice Number:</strong> {invoice_number}<br><strong>Total Amount:</strong> ${total}<br><strong>Due Date:</strong> {due_date}</p><p>If you have any questions about this invoice, please don''t hesitate to contact us.</p><p>Best regards,<br>{business_name}</p>',
      true
    ),
    (
      v_user_id, v_org_id, 'estimate_email', 'Estimate Email', 'email', NULL,
      'Estimate #{estimate_number} from {business_name}',
      '<p>Hello {client_name},</p><p>Thank you for your interest! Please find your estimate below.</p><p><strong>Estimate Number:</strong> {estimate_number}<br><strong>Total Amount:</strong> ${total}<br><strong>Valid Until:</strong> {valid_until}</p><p>We look forward to working with you. If you have any questions or would like to proceed, please let us know!</p><p>Best regards,<br>{business_name}</p>',
      true
    );

  INSERT INTO message_templates (
    user_id, organization_id, template_type, template_name,
    message_text, email_subject, email_body, delivery_method, is_active,
    send_automatically, send_interval_value, send_interval_unit, send_interval_timing
  )
  VALUES
    (
      v_user_id, v_org_id, 'reminder', 'Reminder (SMS)',
      'Hi {client_name}, this is a reminder about your upcoming service on {date} at {time}. Please let us know if you have any questions!',
      NULL, NULL, 'sms', true, false, 1, 'days', 'before'
    ),
    (
      v_user_id, v_org_id, 'reminder', 'Reminder (Email)',
      NULL,
      'Reminder: Your Upcoming Service — {business_name}',
      '<p>Hi {client_name},</p><p>This is a friendly reminder about your upcoming service scheduled for <strong>{date}</strong> at <strong>{time}</strong>.</p><p>If you need to reschedule or have any questions, please don''t hesitate to reach out.</p><p>Best regards,<br>{business_name}</p>',
      'email', true, false, 1, 'days', 'before'
    ),
    (
      v_user_id, v_org_id, 'job_created', 'Job Created (SMS)',
      'Hi {client_name}, a new job has been scheduled for you: {job_title} on {date} at {time}. We look forward to seeing you!',
      NULL, NULL, 'sms', true, false, 0, 'days', 'after'
    ),
    (
      v_user_id, v_org_id, 'job_created', 'Job Created (Email)',
      NULL,
      'Your Job Has Been Scheduled — {business_name}',
      '<p>Hi {client_name},</p><p>Great news! A new job has been scheduled for you:</p><p><strong>Service:</strong> {job_title}<br><strong>Date:</strong> {date}<br><strong>Time:</strong> {time}</p><p>If you have any questions or need to make changes, please contact us.</p><p>Best regards,<br>{business_name}</p>',
      'email', true, false, 0, 'days', 'after'
    );

  SELECT json_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'owner_id', owner_id,
    'join_code', join_code,
    'created_at', created_at
  ) INTO v_result
  FROM organizations
  WHERE id = v_org_id;

  RETURN v_result;
END;
$$;
