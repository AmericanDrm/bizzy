/*
  # Add Clock-Out Prompts Table

  1. New Tables
    - `clock_out_prompts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `time_entry_id` (uuid, references time_entries)
      - `triggered_at` (timestamptz) - when the prompt was triggered
      - `minutes_away` (integer) - how many minutes the user was away from home base
      - `responded_at` (timestamptz, nullable) - when user responded to prompt
      - `action_taken` (text, nullable) - 'clocked_out', 'dismissed', or null if not responded
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `clock_out_prompts` table
    - Add policies for authenticated users to read/write their own prompts
*/

CREATE TABLE IF NOT EXISTS clock_out_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE CASCADE NOT NULL,
  triggered_at timestamptz NOT NULL,
  minutes_away integer NOT NULL DEFAULT 0,
  responded_at timestamptz,
  action_taken text CHECK (action_taken IN ('clocked_out', 'dismissed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clock_out_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clock-out prompts"
  ON clock_out_prompts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clock-out prompts"
  ON clock_out_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clock-out prompts"
  ON clock_out_prompts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_clock_out_prompts_user_id ON clock_out_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_clock_out_prompts_time_entry_id ON clock_out_prompts(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_clock_out_prompts_triggered_at ON clock_out_prompts(triggered_at DESC);
