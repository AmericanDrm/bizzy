/*
  # Add Invoice and Estimate Email Templates

  1. Changes
    - Updates the `create_organization_for_user` function to include default email templates for invoices and estimates
    - Adds customizable email templates with placeholders for dynamic content
    
  2. New Templates
    - `invoice_email` - Email template sent with invoices
    - `estimate_email` - Email template sent with estimates
    
  3. Features
    - Templates support placeholders: {business_name}, {client_name}, {invoice_number}, {estimate_number}, {total}, {due_date}, etc.
    - Both include customizable subject lines and email bodies
    - Delivery method set to 'email' for these templates
*/

-- Update the create_organization_for_user function to include invoice and estimate templates
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
  
  -- Create organization
  INSERT INTO organizations (name, slug, owner_id)
  VALUES (TRIM(p_name), TRIM(p_slug), v_user_id)
  RETURNING id INTO v_org_id;
  
  -- Add user as owner in organization_members
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');
  
  -- Create default message templates (SMS)
  INSERT INTO message_templates (user_id, organization_id, template_type, template_name, message_text, delivery_method, is_active)
  VALUES 
    (v_user_id, v_org_id, 'day_of', 'Day of Appointment', 'Hi {client_name}! This is a reminder about your appointment today at {time} for {job_title}. Looking forward to seeing you!', 'sms', true),
    (v_user_id, v_org_id, 'on_way', 'On the Way', 'Hi {client_name}! I''m on my way to your location for {job_title}. I should arrive in approximately 15 minutes.', 'sms', true),
    (v_user_id, v_org_id, 'follow_up', 'Follow Up', 'Hi {client_name}! Thank you for choosing our services. If you have any questions or concerns about the work completed, please don''t hesitate to reach out!', 'sms', true);
  
  -- Create default email templates for invoices and estimates
  INSERT INTO message_templates (
    user_id, 
    organization_id, 
    template_type, 
    template_name,
    delivery_method, 
    email_subject, 
    email_body, 
    is_active
  )
  VALUES 
    -- Invoice Email Template
    (
      v_user_id, 
      v_org_id, 
      'invoice_email', 
      'Invoice Email',
      'email',
      'Invoice #{invoice_number} from {business_name}',
      '<p>Hello {client_name},</p><p>Thank you for your business! Please find your invoice attached.</p><p><strong>Invoice Number:</strong> {invoice_number}<br><strong>Total Amount:</strong> ${total}<br><strong>Due Date:</strong> {due_date}</p><p>If you have any questions about this invoice, please don''t hesitate to contact us.</p><p>Best regards,<br>{business_name}</p>',
      true
    ),
    -- Estimate Email Template
    (
      v_user_id, 
      v_org_id, 
      'estimate_email', 
      'Estimate Email',
      'email',
      'Estimate #{estimate_number} from {business_name}',
      '<p>Hello {client_name},</p><p>Thank you for your interest! Please find your estimate below.</p><p><strong>Estimate Number:</strong> {estimate_number}<br><strong>Total Amount:</strong> ${total}<br><strong>Valid Until:</strong> {valid_until}</p><p>We look forward to working with you. If you have any questions or would like to proceed, please let us know!</p><p>Best regards,<br>{business_name}</p>',
      true
    );
  
  -- Get the created organization data including join_code
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