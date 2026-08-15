/*
  # Enhanced Productivity Tracking with Clock Integration
  
  ## Overview
  This migration adds comprehensive clock-based productivity tracking with smart location
  management, photo association, and job departure tracking.
  
  ## Changes
  
  ### 1. Home Base Location (profiles table)
    - `home_base_address` (text) - Address of home base location
    - `home_base_latitude` (numeric) - Latitude of home base
    - `home_base_longitude` (numeric) - Longitude of home base
    - `geofence_radius` (integer) - Geofence radius in meters (default: 100)
  
  ### 2. Enhanced Productivity Sessions (productivity_sessions table)
    - `client_id` (uuid) - Reference to client for this session
    - `departure_reason` (text) - Reason for leaving job site (completed, break, next_job, other)
    - `entry_latitude` (numeric) - Entry location latitude
    - `entry_longitude` (numeric) - Entry location longitude
    - `exit_latitude` (numeric) - Exit location latitude
    - `exit_longitude` (numeric) - Exit location longitude
    - `time_entry_id` (uuid) - Link to clock in/out session
  
  ### 3. Photo Location Metadata (client_photos table)
    - `latitude` (numeric) - Photo capture location latitude
    - `longitude` (numeric) - Photo capture location longitude
    - `captured_at` (timestamptz) - When photo was captured
    - `productivity_session_id` (uuid) - Session during which photo was taken
    - `auto_associated` (boolean) - Whether client was automatically determined
    - `distance_from_client` (numeric) - Distance from client location in meters
  
  ### 4. Clock Status (time_entries table)
    - `is_clocked_in` (boolean) - Quick status check for active clock sessions
    - `location_tracking_enabled` (boolean) - Whether location tracking is active
  
  ## Security
    - All new columns respect existing RLS policies
    - No policy changes needed as parent tables already have proper RLS
*/

-- Add home base location fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'home_base_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN home_base_address text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'home_base_latitude'
  ) THEN
    ALTER TABLE profiles ADD COLUMN home_base_latitude numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'home_base_longitude'
  ) THEN
    ALTER TABLE profiles ADD COLUMN home_base_longitude numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'geofence_radius'
  ) THEN
    ALTER TABLE profiles ADD COLUMN geofence_radius integer DEFAULT 100;
  END IF;
END $$;

-- Enhance productivity_sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productivity_sessions' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE productivity_sessions ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productivity_sessions' AND column_name = 'departure_reason'
  ) THEN
    ALTER TABLE productivity_sessions ADD COLUMN departure_reason text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productivity_sessions' AND column_name = 'entry_latitude'
  ) THEN
    ALTER TABLE productivity_sessions ADD COLUMN entry_latitude numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productivity_sessions' AND column_name = 'entry_longitude'
  ) THEN
    ALTER TABLE productivity_sessions ADD COLUMN entry_longitude numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productivity_sessions' AND column_name = 'exit_latitude'
  ) THEN
    ALTER TABLE productivity_sessions ADD COLUMN exit_latitude numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productivity_sessions' AND column_name = 'exit_longitude'
  ) THEN
    ALTER TABLE productivity_sessions ADD COLUMN exit_longitude numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'productivity_sessions' AND column_name = 'time_entry_id'
  ) THEN
    ALTER TABLE productivity_sessions ADD COLUMN time_entry_id uuid REFERENCES time_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add constraint for departure_reason values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'productivity_sessions_departure_reason_check'
  ) THEN
    ALTER TABLE productivity_sessions 
    ADD CONSTRAINT productivity_sessions_departure_reason_check 
    CHECK (departure_reason IN ('completed', 'break', 'next_job', 'other') OR departure_reason IS NULL);
  END IF;
END $$;

-- Add photo location metadata to client_photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_photos' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN latitude numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_photos' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN longitude numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_photos' AND column_name = 'captured_at'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN captured_at timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_photos' AND column_name = 'productivity_session_id'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN productivity_session_id uuid REFERENCES productivity_sessions(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_photos' AND column_name = 'auto_associated'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN auto_associated boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_photos' AND column_name = 'distance_from_client'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN distance_from_client numeric;
  END IF;
END $$;

-- Add clock status fields to time_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'is_clocked_in'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN is_clocked_in boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'location_tracking_enabled'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN location_tracking_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Create index for faster clock status queries
CREATE INDEX IF NOT EXISTS idx_time_entries_is_clocked_in ON time_entries(user_id, is_clocked_in) WHERE is_clocked_in = true;

-- Create index for photo location queries
CREATE INDEX IF NOT EXISTS idx_client_photos_location ON client_photos(user_id, latitude, longitude) WHERE latitude IS NOT NULL;

-- Create index for productivity sessions by client
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_client ON productivity_sessions(client_id, user_id);

-- Create index for productivity sessions by time entry
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_time_entry ON productivity_sessions(time_entry_id);