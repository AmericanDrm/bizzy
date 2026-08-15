/*
  # Add Stripe Session Tracking and Receipt/Review Settings

  ## Summary
  This migration adds infrastructure for linking invoices to Stripe Checkout Sessions
  (so webhooks can auto-mark invoices as paid) and adds business settings for 
  controlling automatic receipt emails and Google review prompts.

  ## Changes

  ### invoices table
  - `stripe_session_id` (text, nullable) - Stores the Stripe Checkout Session ID when a 
    unique checkout link is generated for an invoice. Used by the stripe-webhook handler 
    to identify which invoice to mark as paid.

  ### business_settings table
  - `send_receipt_email` (boolean, default true) - When true, automatically send a receipt 
    email when an invoice is paid by credit card (via Stripe webhook or manual mark-as-paid).
  - `include_google_review_on_receipt` (boolean, default false) - When true, append a Google 
    review request section to receipt emails.
  - `include_google_review_on_invoice` (boolean, default false) - When true, append a Google 
    review request section to invoice send emails.

  ## Security
  - No new tables, so no new RLS policies needed. Existing policies on invoices and 
    business_settings cover these columns.
  - The stripe_session_id is server-only data; clients cannot set it directly through 
    normal app flows (it is set by the create-stripe-checkout edge function).
*/

-- Add stripe_session_id to invoices for webhook-based auto-pay matching
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'stripe_session_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN stripe_session_id text;
  END IF;
END $$;

-- Add index for fast lookup when webhook fires
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_session_id ON invoices(stripe_session_id);

-- Add receipt email toggle to business_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'send_receipt_email'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN send_receipt_email boolean DEFAULT true;
  END IF;
END $$;

-- Add Google review toggle for receipt emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'include_google_review_on_receipt'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN include_google_review_on_receipt boolean DEFAULT false;
  END IF;
END $$;

-- Add Google review toggle for invoice send emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'include_google_review_on_invoice'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN include_google_review_on_invoice boolean DEFAULT false;
  END IF;
END $$;
