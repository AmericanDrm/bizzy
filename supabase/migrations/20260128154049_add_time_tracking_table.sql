/*
  # Add Time Tracking Table

  1. New Tables
    - `time_entries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `clock_in` (timestamptz, required) - When user clocked in
      - `clock_out` (timestamptz, nullable) - When user clocked out (null if still clocked in)
      - `notes` (text, optional) - Optional notes about the time entry
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `time_entries` table
    - Add policies for authenticated users to:
      - Read their own time entries
      - Insert their own time entries
      - Update their own time entries (for clocking out)
      - Delete their own time entries
*/

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own time entries"
  ON time_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS time_entries_user_id_idx ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS time_entries_clock_in_idx ON time_entries(clock_in);
CREATE INDEX IF NOT EXISTS time_entries_clock_out_idx ON time_entries(clock_out);