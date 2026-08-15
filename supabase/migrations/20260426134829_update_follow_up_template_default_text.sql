/*
  # Update follow_up SMS template default text

  ## Summary
  Updates the default follow-up SMS template to a review-request message that
  includes the business name, technician name, and review link placeholders.

  ## Changes
  - Updates `message_text` for all `follow_up` type SMS templates that still contain
    the old default text, replacing it with the new review-request template.
  - Organizations that have already customized their follow-up template are NOT affected
    (only the exact old default text is replaced).

  ## New Template
  "Hi {client_name}, this is {business_name}. If you were happy with your service from
  {technician_name}, would you mind leaving us a quick review? It really helps: {review_link}
  If anything wasn't perfect, let us know—we'd love to make it right."

  ## New Placeholders Available
  {client_name}, {business_name}, {technician_name}, {review_link}
*/

UPDATE message_templates
SET
  message_text = E'Hi {client_name}, this is {business_name}. If you were happy with your service from {technician_name}, would you mind leaving us a quick review? It really helps: {review_link}\nIf anything wasn\'t perfect, let us know\u2014we\'d love to make it right.',
  updated_at = now()
WHERE
  template_type = 'follow_up'
  AND delivery_method = 'sms'
  AND (
    message_text = 'Hi {client_name}! Thank you for choosing our services. If you have any questions or concerns about the work completed, please don''t hesitate to reach out!'
    OR message_text IS NULL
    OR message_text = ''
  );
