/*
  # Add Review Follow-Up Tracking to Clients

  ## Summary
  Adds a nullable timestamp column to the clients table to track when a Google
  review follow-up SMS was last sent to each client.

  ## Changes
  - `clients` table: new column `review_follow_up_sent_at` (timestamptz, nullable)
    - NULL = never sent a review follow-up
    - Non-null = timestamp of the most recent follow-up send

  ## Purpose
  - Prevents duplicate auto-sends: the auto follow-up SMS on job completion only
    fires if this field is NULL
  - Drives the green check indicator on client cards and the client profile modal
  - Allows businesses to manually re-send from the client profile at any time
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'review_follow_up_sent_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN review_follow_up_sent_at timestamptz DEFAULT NULL;
  END IF;
END $$;
