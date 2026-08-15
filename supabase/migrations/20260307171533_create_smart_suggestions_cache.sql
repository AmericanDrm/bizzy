/*
  # Create Smart Suggestions Cache Table

  1. New Tables
    - `smart_suggestions_cache`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `organization_id` (uuid, references organizations)
      - `suggestion_type` (text) - type of suggestion: uninvoiced_job, unpaid_reminder, recurring_visit, pending_estimate, account_balance
      - `suggestion_data` (jsonb) - full suggestion payload including label, description, action data
      - `priority_score` (numeric) - numeric ranking score for sorting
      - `expires_at` (timestamptz) - when this cached suggestion expires
      - `created_at` (timestamptz) - when the cache entry was created

  2. Security
    - Enable RLS on `smart_suggestions_cache` table
    - Add policies for authenticated users to read/write their own organization's suggestions

  3. Indexes
    - Composite index on (user_id, organization_id, expires_at) for efficient lookups
    - Index on expires_at for cleanup queries
*/

CREATE TABLE IF NOT EXISTS smart_suggestions_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid NOT NULL,
  suggestion_type text NOT NULL DEFAULT '',
  suggestion_data jsonb NOT NULL DEFAULT '{}',
  priority_score numeric NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE smart_suggestions_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_smart_suggestions_cache_user_org_expires
  ON smart_suggestions_cache (user_id, organization_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_smart_suggestions_cache_expires
  ON smart_suggestions_cache (expires_at);

CREATE POLICY "Users can read own org suggestions"
  ON smart_suggestions_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suggestions"
  ON smart_suggestions_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestions"
  ON smart_suggestions_cache
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own suggestions"
  ON smart_suggestions_cache
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
