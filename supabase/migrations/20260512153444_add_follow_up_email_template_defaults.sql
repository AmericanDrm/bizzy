/*
  # Add default follow_up email template for all organizations

  1. New Templates
    Inserts a `follow_up` email row for every organization that has
    an SMS follow_up template but no email equivalent yet. Inherits
    `user_id` from the org's existing SMS follow_up row.
    Uses `email_subject` + `email_body` columns (dedicated email fields).

  2. Default wording
    Mirrors the SMS template tone but formatted for email.

  3. Safety
    WHERE NOT EXISTS prevents duplicates.
*/

INSERT INTO message_templates (
  user_id,
  organization_id,
  template_type,
  template_name,
  delivery_method,
  email_subject,
  email_body,
  message_text,
  is_active
)
SELECT DISTINCT ON (mt.organization_id)
  mt.user_id,
  mt.organization_id,
  'follow_up',
  'Review Request (Email)',
  'email',
  'How did we do, {client_name}?',
  'Hi {client_name},' || chr(10) || chr(10) ||
  'Thank you for choosing {business_name}! We hope you are happy with your recent service.' || chr(10) || chr(10) ||
  'If you have a moment, we would really appreciate it if you left us a review — it makes a huge difference to our small business:' || chr(10) ||
  '{review_link}' || chr(10) || chr(10) ||
  'If anything wasn''t perfect, please let us know. We''d love the chance to make it right.' || chr(10) || chr(10) ||
  'Thank you,' || chr(10) ||
  '{business_name}',
  'Hi {client_name},' || chr(10) || chr(10) ||
  'Thank you for choosing {business_name}! We hope you are happy with your recent service.' || chr(10) || chr(10) ||
  'If you have a moment, we would really appreciate it if you left us a review — it makes a huge difference to our small business:' || chr(10) ||
  '{review_link}' || chr(10) || chr(10) ||
  'If anything wasn''t perfect, please let us know. We''d love the chance to make it right.' || chr(10) || chr(10) ||
  'Thank you,' || chr(10) ||
  '{business_name}',
  true
FROM message_templates mt
WHERE mt.template_type = 'follow_up'
  AND mt.delivery_method = 'sms'
  AND NOT EXISTS (
    SELECT 1 FROM message_templates ex
    WHERE ex.organization_id = mt.organization_id
      AND ex.template_type = 'follow_up'
      AND ex.delivery_method = 'email'
  );
