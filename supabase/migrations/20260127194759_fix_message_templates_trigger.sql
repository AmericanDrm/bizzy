/*
  # Fix Message Templates Trigger

  ## Problem
  The trigger that creates default message templates for new users fails because
  RLS blocks the inserts during the signup process (user isn't authenticated yet).

  ## Solution
  Recreate the trigger function with SECURITY DEFINER to allow it to bypass RLS
  when inserting default templates for new users.

  ## Changes
  - Drop and recreate the `create_default_message_templates` function with SECURITY DEFINER
  - The trigger itself remains unchanged
*/

CREATE OR REPLACE FUNCTION create_default_message_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO message_templates (user_id, template_type, message_text, is_active)
  VALUES
    (NEW.id, 'day_of', 'Hi {client_name}! This is a reminder about your appointment today at {time} for {job_title}. Looking forward to seeing you!', true),
    (NEW.id, 'on_way', 'Hi {client_name}! I''m on my way to your location for {job_title}. I should arrive in approximately 15 minutes.', true),
    (NEW.id, 'follow_up', 'Hi {client_name}! Thank you for choosing our services. If you have any questions or concerns about the work completed, please don''t hesitate to reach out!', true);
  
  RETURN NEW;
END;
$$;