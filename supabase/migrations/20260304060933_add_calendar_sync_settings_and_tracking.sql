/*
  # Calendar Sync Settings and Tracking

  1. New Tables
    - `calendar_sync_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `organization_id` (uuid)
      - `device_calendar_id` (text) - native calendar ID on device
      - `calendar_name` (text) - display name of selected calendar
      - `sync_enabled` (boolean, default false)
      - `sync_direction` (text) - 'two_way', 'app_to_calendar', 'calendar_to_app'
      - `last_synced_at` (timestamptz) - last successful sync timestamp
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `schedule_events`
      - Added `external_calendar_event_id` (text) - native calendar event ID
      - Added `sync_source` (text) - origin: 'app', 'device', 'google_import'
      - Added `last_synced_at` (timestamptz)

  3. Security
    - Enable RLS on `calendar_sync_settings`
    - Users can only access their own sync settings
*/

-- Add sync tracking columns to schedule_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'external_calendar_event_id'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN external_calendar_event_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'sync_source'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN sync_source text DEFAULT 'app';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN last_synced_at timestamptz;
  END IF;
END $$;

-- Create calendar_sync_settings table
CREATE TABLE IF NOT EXISTS calendar_sync_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid,
  device_calendar_id text NOT NULL DEFAULT '',
  calendar_name text NOT NULL DEFAULT '',
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_direction text NOT NULL DEFAULT 'two_way',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_settings_user_id ON calendar_sync_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_external_cal_id ON schedule_events(external_calendar_event_id) WHERE external_calendar_event_id IS NOT NULL;

ALTER TABLE calendar_sync_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync settings"
  ON calendar_sync_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync settings"
  ON calendar_sync_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync settings"
  ON calendar_sync_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync settings"
  ON calendar_sync_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
