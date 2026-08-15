-- Add service_address_id to schedule_events
-- Links calendar events to a specific client address (when the estimate had one)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_events' AND column_name = 'service_address_id'
  ) THEN
    ALTER TABLE schedule_events
      ADD COLUMN service_address_id uuid REFERENCES client_addresses(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_events_service_address_id
  ON schedule_events(service_address_id);
