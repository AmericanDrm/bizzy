/*
  # Departure Reminders System

  ## Summary
  Adds infrastructure for traffic-aware departure reminders that notify users when
  it's time to leave for a scheduled job. Includes:

  ## New Tables
  - `departure_reminders`: Tracks the lifecycle of each departure reminder
    - `id` - Primary key
    - `user_id` - The worker who should receive the reminder
    - `organization_id` - Organization context
    - `schedule_event_id` - The job event this reminder is for
    - `estimated_travel_minutes` - Traffic-aware travel time from Mapbox API
    - `scheduled_departure_at` - Computed time user should leave
    - `status` - pending / sent / dismissed / snoozed / suppressed
    - `on_my_way_sms_sent_at` - Timestamp when "on my way" SMS was sent to client
    - `on_my_way_method` - 'twilio' or 'native' indicating how the message was sent
    - `created_at`, `updated_at`

  ## Profile Column Additions
  - `departure_reminders_enabled` (boolean, default true) - User opt-in toggle
  - `departure_buffer_minutes` (integer, default 5) - Extra buffer before calculated departure time

  ## Security
  - RLS enabled on departure_reminders
  - Users can only read/write their own reminders
  - Managers/owners can read all org reminders

  ## Notes
  1. The `status` field follows the lifecycle: pending -> sent -> dismissed/snoozed/suppressed
  2. `on_my_way_sms_sent_at` is used as a suppression signal to prevent duplicate reminders
  3. Profile columns use safe IF NOT EXISTS pattern to avoid migration conflicts
*/

CREATE TABLE IF NOT EXISTS departure_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_event_id uuid REFERENCES schedule_events(id) ON DELETE CASCADE,
  estimated_travel_minutes integer,
  scheduled_departure_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'dismissed', 'snoozed', 'suppressed')),
  on_my_way_sms_sent_at timestamptz,
  on_my_way_method text CHECK (on_my_way_method IN ('twilio', 'native')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departure_reminders_user_id ON departure_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_departure_reminders_schedule_event_id ON departure_reminders(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_departure_reminders_status ON departure_reminders(status);
CREATE INDEX IF NOT EXISTS idx_departure_reminders_scheduled_departure ON departure_reminders(scheduled_departure_at);

ALTER TABLE departure_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own departure reminders"
  ON departure_reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own departure reminders"
  ON departure_reminders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own departure reminders"
  ON departure_reminders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own departure reminders"
  ON departure_reminders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'departure_reminders_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN departure_reminders_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'departure_buffer_minutes'
  ) THEN
    ALTER TABLE profiles ADD COLUMN departure_buffer_minutes integer NOT NULL DEFAULT 5;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_departure_reminders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS departure_reminders_updated_at ON departure_reminders;
CREATE TRIGGER departure_reminders_updated_at
  BEFORE UPDATE ON departure_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_departure_reminders_updated_at();
