/*
  # Estimate Signatures and Client Approvals

  1. Changes to estimates table
    - Add `requires_signature` boolean flag
    - Add `signed_at` timestamp for when client signs
    - Add `signature_data` for storing signature as base64
    - Add `signed_by_name` for client name on signature
    - Add `signed_by_email` for client email on signature
    - Add `client_notes` for client feedback/notes
    
  2. Changes to estimate_items table
    - Add `approved_by_client` boolean to track which items client selected
    - Add `client_notes` for item-specific client feedback
    
  3. Features Enabled
    - Toggle signature requirement per estimate
    - Client can digitally sign estimates
    - Client can select which items to approve (especially optional ones)
    - Track approval status and signature details
    - Client can add notes during approval
*/

-- =====================================================
-- PART 1: ENHANCE ESTIMATES TABLE FOR SIGNATURES
-- =====================================================

DO $$
BEGIN
  -- Add requires_signature column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'requires_signature'
  ) THEN
    ALTER TABLE estimates 
    ADD COLUMN requires_signature boolean DEFAULT false;
  END IF;

  -- Add signed_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE estimates 
    ADD COLUMN signed_at timestamptz;
  END IF;

  -- Add signature_data column (stores base64 signature image)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'signature_data'
  ) THEN
    ALTER TABLE estimates 
    ADD COLUMN signature_data text;
  END IF;

  -- Add signed_by_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'signed_by_name'
  ) THEN
    ALTER TABLE estimates 
    ADD COLUMN signed_by_name text;
  END IF;

  -- Add signed_by_email column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'signed_by_email'
  ) THEN
    ALTER TABLE estimates 
    ADD COLUMN signed_by_email text;
  END IF;

  -- Add client_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'client_notes'
  ) THEN
    ALTER TABLE estimates 
    ADD COLUMN client_notes text;
  END IF;
END $$;

-- =====================================================
-- PART 2: ENHANCE ESTIMATE_ITEMS FOR CLIENT APPROVAL
-- =====================================================

DO $$
BEGIN
  -- Add approved_by_client column (tracks which items client selected)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'approved_by_client'
  ) THEN
    ALTER TABLE estimate_items 
    ADD COLUMN approved_by_client boolean DEFAULT true;
  END IF;

  -- Add client_notes column for item-specific feedback
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_items' AND column_name = 'client_notes'
  ) THEN
    ALTER TABLE estimate_items 
    ADD COLUMN client_notes text;
  END IF;
END $$;

-- =====================================================
-- PART 3: CREATE INDEX FOR SIGNED ESTIMATES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_estimates_signed_at 
  ON estimates(signed_at) WHERE signed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_requires_signature 
  ON estimates(requires_signature) WHERE requires_signature = true;