/*
  # Add Layout Preferences Table

  1. New Tables
    - `layout_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, unique)
      - `home_cards` (jsonb) - Array of card IDs with order and visibility
      - `tabs` (jsonb) - Array of tab IDs with order and visibility
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `layout_preferences` table
    - Add policies for users to manage their own preferences

  3. Notes
    - Default cards: clients, jobs, schedule, time (max 6)
    - Default tabs: home, clients, schedule, invoices, notes, finances (max 6)
*/

CREATE TABLE IF NOT EXISTS layout_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  home_cards jsonb DEFAULT '[
    {"id": "clients", "visible": true},
    {"id": "jobs", "visible": true},
    {"id": "schedule", "visible": true},
    {"id": "time", "visible": true}
  ]'::jsonb,
  tabs jsonb DEFAULT '[
    {"id": "index", "visible": true},
    {"id": "clients", "visible": true},
    {"id": "schedule", "visible": true},
    {"id": "invoices", "visible": true},
    {"id": "notes", "visible": true},
    {"id": "finances", "visible": true}
  ]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE layout_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own layout preferences"
  ON layout_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own layout preferences"
  ON layout_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own layout preferences"
  ON layout_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own layout preferences"
  ON layout_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);