/*
  # Add FAQ and Walkthrough Analytics Tables

  ## Overview
  This migration adds comprehensive analytics tracking for the FAQ system and app walkthrough features.
  It also extends the profiles table to track walkthrough completion and preferences.

  ## New Tables

  ### 1. faq_analytics
  Tracks all FAQ-related user interactions for analytics and improvement insights
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `faq_item_id` (text) - Identifier for the FAQ item
  - `category` (text) - FAQ category
  - `action_type` (text) - Type of action: 'viewed', 'search', 'show_me_clicked', 'feedback_helpful', 'feedback_not_helpful'
  - `search_query` (text, nullable) - Search query if action was a search
  - `session_id` (uuid, nullable) - For grouping related actions
  - `created_at` (timestamptz)

  ### 2. walkthrough_analytics
  Tracks all walkthrough-related user interactions for completion rates and optimization
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `session_id` (uuid) - Groups actions within a single walkthrough session
  - `step_id` (text, nullable) - Identifier for the walkthrough step
  - `action_type` (text) - Type of action: 'started', 'completed', 'skipped', 'step_viewed', 'step_skipped', 'resumed', 'restarted'
  - `source` (text, nullable) - Where walkthrough was triggered from: 'first_time', 'settings', 'help_button', 'reminder'
  - `time_spent_seconds` (integer, nullable) - Time spent on the step
  - `completion_percentage` (numeric, nullable) - Overall progress when action occurred
  - `created_at` (timestamptz)

  ## Profile Table Updates
  Adds walkthrough tracking columns to profiles table:
  - `has_seen_walkthrough_prompt` (boolean) - Whether user has seen the initial welcome modal
  - `walkthrough_skipped_at` (timestamptz) - When user skipped the walkthrough
  - `walkthrough_completed_at` (timestamptz) - When user completed the walkthrough
  - `walkthrough_last_step` (text) - Last step viewed for resume functionality
  - `show_walkthrough_reminders` (boolean) - Whether to show gentle reminders

  ## Security
  - RLS enabled on all new tables
  - Users can only read/write their own analytics data
  - Authenticated users only

  ## Important Notes
  - Analytics data helps improve app UX and identify pain points
  - Session IDs allow grouping related actions for analysis
  - Time tracking enables optimization of walkthrough pace
  - Search queries help identify missing FAQ content
*/

-- Create FAQ analytics table
CREATE TABLE IF NOT EXISTS faq_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faq_item_id text NOT NULL,
  category text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('viewed', 'search', 'show_me_clicked', 'feedback_helpful', 'feedback_not_helpful')),
  search_query text,
  session_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create walkthrough analytics table
CREATE TABLE IF NOT EXISTS walkthrough_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  step_id text,
  action_type text NOT NULL CHECK (action_type IN ('started', 'completed', 'skipped', 'step_viewed', 'step_skipped', 'resumed', 'restarted')),
  source text CHECK (source IN ('first_time', 'settings', 'help_button', 'reminder')),
  time_spent_seconds integer,
  completion_percentage numeric(5,2),
  created_at timestamptz DEFAULT now()
);

-- Add walkthrough tracking columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'has_seen_walkthrough_prompt'
  ) THEN
    ALTER TABLE profiles ADD COLUMN has_seen_walkthrough_prompt boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'walkthrough_skipped_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN walkthrough_skipped_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'walkthrough_completed_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN walkthrough_completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'walkthrough_last_step'
  ) THEN
    ALTER TABLE profiles ADD COLUMN walkthrough_last_step text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'show_walkthrough_reminders'
  ) THEN
    ALTER TABLE profiles ADD COLUMN show_walkthrough_reminders boolean DEFAULT true;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE faq_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for faq_analytics
CREATE POLICY "Users can insert own FAQ analytics"
  ON faq_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own FAQ analytics"
  ON faq_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for walkthrough_analytics
CREATE POLICY "Users can insert own walkthrough analytics"
  ON walkthrough_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own walkthrough analytics"
  ON walkthrough_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_faq_analytics_user_id ON faq_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_faq_analytics_created_at ON faq_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_faq_analytics_action_type ON faq_analytics(action_type);

CREATE INDEX IF NOT EXISTS idx_walkthrough_analytics_user_id ON walkthrough_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_walkthrough_analytics_session_id ON walkthrough_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_walkthrough_analytics_created_at ON walkthrough_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_walkthrough_analytics_action_type ON walkthrough_analytics(action_type);
