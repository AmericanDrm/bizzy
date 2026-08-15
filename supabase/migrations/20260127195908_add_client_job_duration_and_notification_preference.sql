/*
  # Add job duration and notification preference to clients

  ## Modified Tables
  
  ### clients
  - `typical_job_duration` (integer) - Default job duration in minutes for this client
  - `notification_preference` (text) - Preferred notification method: 'email', 'text', 'both', or 'none'
  
  ## Important Notes
  1. These fields help streamline scheduling by auto-filling job duration
  2. Notification preference determines how clients want to be contacted about appointments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'typical_job_duration'
  ) THEN
    ALTER TABLE clients ADD COLUMN typical_job_duration integer DEFAULT 60;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'notification_preference'
  ) THEN
    ALTER TABLE clients ADD COLUMN notification_preference text DEFAULT 'none';
  END IF;
END $$;