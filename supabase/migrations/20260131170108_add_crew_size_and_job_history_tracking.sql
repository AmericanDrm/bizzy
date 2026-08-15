/*
  # Add Crew Size and Job History Tracking

  ## Overview
  This migration adds intelligent scheduling capabilities based on historical job data and crew size adjustments.

  ## New Tables
  
  ### crew_efficiency_rules
  Stores crew efficiency multipliers for duration calculations
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Links to authenticated user
  - `crew_size` (integer) - Number of workers (1, 2, 3, etc.)
  - `efficiency_multiplier` (decimal) - Time multiplier (e.g., 0.6 = 60% of base time)
  - `service_type` (text, nullable) - Optional: specific to a service type
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ## Modified Tables

  ### schedule_events
  - `crew_size` (integer) - Number of workers assigned, default 1
  - `estimated_duration_minutes` (integer) - Predicted duration based on history
  - `confidence_score` (decimal) - Reliability of estimate (0-1)
  - `base_duration_minutes` (integer) - Duration before crew size adjustment

  ### jobs
  - `crew_size` (integer) - Actual crew size used for the job
  - `actual_duration_minutes` (integer) - Actual time spent on job
  - `estimated_duration_minutes` (integer) - Original estimate for comparison
  - `service_type` (text) - Type of service performed

  ## Security
  - RLS enabled on crew_efficiency_rules table
  - Users can only access their own efficiency rules
  - Separate policies for SELECT, INSERT, UPDATE, and DELETE

  ## Important Notes
  1. Default crew size is 1 person
  2. Efficiency multipliers default to reasonable values (2 people = 0.6, 3 people = 0.45, etc.)
  3. Historical data enables learning and improving predictions over time
  4. Confidence score helps users understand estimate reliability
*/

-- Create crew_efficiency_rules table
CREATE TABLE IF NOT EXISTS crew_efficiency_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crew_size integer NOT NULL CHECK (crew_size > 0),
  efficiency_multiplier numeric(4,2) NOT NULL CHECK (efficiency_multiplier > 0 AND efficiency_multiplier <= 1),
  service_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, crew_size, service_type)
);

-- Add columns to schedule_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'crew_size'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN crew_size integer DEFAULT 1 NOT NULL CHECK (crew_size > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'estimated_duration_minutes'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN estimated_duration_minutes integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'base_duration_minutes'
  ) THEN
    ALTER TABLE schedule_events ADD COLUMN base_duration_minutes integer;
  END IF;
END $$;

-- Add columns to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'crew_size'
  ) THEN
    ALTER TABLE jobs ADD COLUMN crew_size integer DEFAULT 1 NOT NULL CHECK (crew_size > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'actual_duration_minutes'
  ) THEN
    ALTER TABLE jobs ADD COLUMN actual_duration_minutes integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'estimated_duration_minutes'
  ) THEN
    ALTER TABLE jobs ADD COLUMN estimated_duration_minutes integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN service_type text DEFAULT '';
  END IF;
END $$;

-- Enable RLS on crew_efficiency_rules
ALTER TABLE crew_efficiency_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crew_efficiency_rules
CREATE POLICY "Users can view own crew efficiency rules"
  ON crew_efficiency_rules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own crew efficiency rules"
  ON crew_efficiency_rules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own crew efficiency rules"
  ON crew_efficiency_rules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own crew efficiency rules"
  ON crew_efficiency_rules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_crew_efficiency_user_crew_size 
  ON crew_efficiency_rules(user_id, crew_size);

CREATE INDEX IF NOT EXISTS idx_crew_efficiency_service_type 
  ON crew_efficiency_rules(service_type) 
  WHERE service_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_events_crew_size 
  ON schedule_events(crew_size);

CREATE INDEX IF NOT EXISTS idx_jobs_client_completed 
  ON jobs(client_id, status) 
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_jobs_duration_tracking 
  ON jobs(client_id, service_type, actual_duration_minutes) 
  WHERE actual_duration_minutes IS NOT NULL;

-- Insert default crew efficiency rules function (will be called from app)
CREATE OR REPLACE FUNCTION initialize_default_crew_efficiency_rules(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert default efficiency multipliers if none exist for this user
  INSERT INTO crew_efficiency_rules (user_id, crew_size, efficiency_multiplier, service_type)
  VALUES 
    (p_user_id, 1, 1.00, NULL),
    (p_user_id, 2, 0.60, NULL),
    (p_user_id, 3, 0.45, NULL),
    (p_user_id, 4, 0.35, NULL),
    (p_user_id, 5, 0.30, NULL)
  ON CONFLICT (user_id, crew_size, service_type) DO NOTHING;
END;
$$;