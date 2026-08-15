/*
  # Add Swipe Action Preferences to Layout Preferences

  ## Summary
  Adds two new JSONB columns to `layout_preferences` to store per-user
  configurable swipe action slots for the Clients and Invoices/Estimates screens.

  ## New Columns

  ### `swipe_actions_clients` (jsonb)
  Stores up to 3 right-swipe action IDs for the clients list.
  Each element is a string action ID from the set:
    - 'call'      – open phone dialer
    - 'schedule'  – open schedule modal
    - 'invoice'   – create new invoice for client
    - 'message'   – open quick-send message modal
    - 'delete'    – delete client

  Default: ["call", "schedule", "delete"]

  ### `swipe_actions_invoices` (jsonb)
  Stores action IDs for the invoices list.
  Right-swipe slots (up to 3):
    - 'mark_paid'  – mark invoice as paid
    - 'pdf'        – download PDF
    - 'send'       – send/email invoice
    - 'delete'     – delete invoice
  Left-swipe slot (1):
    - 'remind'     – send payment reminder
    - 'send'       – send invoice

  Default: {"right": ["mark_paid", "pdf", "delete"], "left": ["remind"]}

  ## Notes
  - No data migration needed; existing rows will get NULL which the app treats as defaults
  - No RLS changes required; existing policies cover these new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'layout_preferences' AND column_name = 'swipe_actions_clients'
  ) THEN
    ALTER TABLE layout_preferences ADD COLUMN swipe_actions_clients jsonb DEFAULT '["call","schedule","delete"]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'layout_preferences' AND column_name = 'swipe_actions_invoices'
  ) THEN
    ALTER TABLE layout_preferences ADD COLUMN swipe_actions_invoices jsonb DEFAULT '{"right":["mark_paid","pdf","delete"],"left":["remind"]}'::jsonb;
  END IF;
END $$;
