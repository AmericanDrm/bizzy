/*
  # Estimate Approval Tokens & Job Linking

  1. New Tables
    - `estimate_approval_tokens`
      - `id` (uuid, primary key)
      - `estimate_id` (uuid, FK to estimates) - the estimate this token grants access to
      - `token` (text, unique) - secure random token for URL
      - `expires_at` (timestamptz) - when this token expires
      - `used_at` (timestamptz) - when the client used this token to approve
      - `created_at` (timestamptz)

  2. Modified Tables
    - `schedule_events`
      - Added `estimate_id` (uuid, FK to estimates) - links a job back to the estimate it was created from

  3. Security
    - RLS enabled on `estimate_approval_tokens`
    - Owners can manage their own tokens (via estimate ownership)
    - Service role used by edge functions for public approval

  4. Notes
    - Tokens are generated when sending estimate emails
    - Clients use tokens to access a public approval page without authentication
    - Once used, `used_at` is set to prevent re-approval
    - Tokens expire based on the estimate's validity period
*/

-- Create estimate_approval_tokens table
CREATE TABLE IF NOT EXISTS estimate_approval_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estimate_approval_tokens ENABLE ROW LEVEL SECURITY;

-- Owners can view their estimate tokens
CREATE POLICY "Users can view own estimate tokens"
  ON estimate_approval_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_approval_tokens.estimate_id
      AND estimates.user_id = auth.uid()
    )
  );

-- Owners can create tokens for their estimates
CREATE POLICY "Users can create tokens for own estimates"
  ON estimate_approval_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_approval_tokens.estimate_id
      AND estimates.user_id = auth.uid()
    )
  );

-- Owners can delete their tokens
CREATE POLICY "Users can delete own estimate tokens"
  ON estimate_approval_tokens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = estimate_approval_tokens.estimate_id
      AND estimates.user_id = auth.uid()
    )
  );

-- Add estimate_id to schedule_events for linking approved estimates to jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'estimate_id'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN estimate_id uuid REFERENCES estimates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_estimate_approval_tokens_token ON estimate_approval_tokens(token);

-- Index for estimate_id on schedule_events
CREATE INDEX IF NOT EXISTS idx_schedule_events_estimate_id ON schedule_events(estimate_id);

-- Index for estimate_id on approval tokens
CREATE INDEX IF NOT EXISTS idx_estimate_approval_tokens_estimate_id ON estimate_approval_tokens(estimate_id);
