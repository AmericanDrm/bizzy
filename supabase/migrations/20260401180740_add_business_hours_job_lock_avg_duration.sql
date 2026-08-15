/*
  # Add Business Hours, Job Lock, and Avg Duration

  ## Summary
  Adds support for:
  1. Per-day business hours in business_settings (with Monday-copy shortcut support)
  2. is_locked flag on schedule_events for Anchor jobs
  3. job_type_avg_duration_minutes on job_types for Smart Scheduler learning

  ## New Columns

  ### business_settings
  - `hours_mon_start` (time) - Monday start time, default 08:00
  - `hours_mon_end` (time) - Monday end time, default 17:00
  - `hours_tue_start` (time) - Tuesday start time
  - `hours_tue_end` (time) - Tuesday end time
  - `hours_wed_start` (time) - Wednesday start time
  - `hours_wed_end` (time) - Wednesday end time
  - `hours_thu_start` (time) - Thursday start time
  - `hours_thu_end` (time) - Thursday end time
  - `hours_fri_start` (time) - Friday start time
  - `hours_fri_end` (time) - Friday end time
  - `hours_sat_start` (time) - Saturday start time (nullable = closed)
  - `hours_sat_end` (time) - Saturday end time
  - `hours_sun_start` (time) - Sunday start time (nullable = closed)
  - `hours_sun_end` (time) - Sunday end time

  ### schedule_events
  - `is_locked` (boolean, default false) - Whether this is an Anchor job that the optimizer will not move

  ### job_types
  - `avg_duration_minutes` (integer, nullable) - Rolling average actual duration in minutes, updated by geofence exit events

  ## Security
  - No new tables, RLS already enabled on all affected tables
  - existing policies cover these new columns
*/

DO $$
BEGIN
  -- business_settings: per-day hours
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_mon_start') THEN
    ALTER TABLE business_settings ADD COLUMN hours_mon_start time DEFAULT '08:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_mon_end') THEN
    ALTER TABLE business_settings ADD COLUMN hours_mon_end time DEFAULT '17:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_tue_start') THEN
    ALTER TABLE business_settings ADD COLUMN hours_tue_start time DEFAULT '08:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_tue_end') THEN
    ALTER TABLE business_settings ADD COLUMN hours_tue_end time DEFAULT '17:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_wed_start') THEN
    ALTER TABLE business_settings ADD COLUMN hours_wed_start time DEFAULT '08:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_wed_end') THEN
    ALTER TABLE business_settings ADD COLUMN hours_wed_end time DEFAULT '17:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_thu_start') THEN
    ALTER TABLE business_settings ADD COLUMN hours_thu_start time DEFAULT '08:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_thu_end') THEN
    ALTER TABLE business_settings ADD COLUMN hours_thu_end time DEFAULT '17:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_fri_start') THEN
    ALTER TABLE business_settings ADD COLUMN hours_fri_start time DEFAULT '08:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_fri_end') THEN
    ALTER TABLE business_settings ADD COLUMN hours_fri_end time DEFAULT '17:00:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_sat_start') THEN
    ALTER TABLE business_settings ADD COLUMN hours_sat_start time DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_sat_end') THEN
    ALTER TABLE business_settings ADD COLUMN hours_sat_end time DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_sun_start') THEN
    ALTER TABLE business_settings ADD COLUMN hours_sun_start time DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'hours_sun_end') THEN
    ALTER TABLE business_settings ADD COLUMN hours_sun_end time DEFAULT NULL;
  END IF;

  -- schedule_events: is_locked
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_events' AND column_name = 'is_locked') THEN
    ALTER TABLE schedule_events ADD COLUMN is_locked boolean NOT NULL DEFAULT false;
  END IF;

  -- job_types: avg_duration_minutes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_types' AND column_name = 'avg_duration_minutes') THEN
    ALTER TABLE job_types ADD COLUMN avg_duration_minutes integer DEFAULT NULL;
  END IF;
END $$;
