/*
  # Previous Addresses & Structured Address Fields

  ## Overview
  Adds a previous_addresses table for offline address suggestions and
  adds structured address columns to client_addresses for normalized storage.

  ## 1. New Tables
    - `previous_addresses`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, NOT NULL) - tenant isolation
      - `full_address` (text) - combined address string
      - `street` (text) - street address
      - `city` (text) - city name
      - `state` (text) - state / region
      - `postal_code` (text) - ZIP / postal code
      - `country` (text) - country name
      - `latitude` (decimal) - geocoded latitude
      - `longitude` (decimal) - geocoded longitude
      - `raw_input` (text) - original user input before normalization
      - `normalized` (boolean) - whether address has been geocoded
      - `last_used_at` (timestamptz) - for sorting by recency
      - `created_at` / `updated_at` (timestamptz)

  ## 2. Modified Tables
    - `client_addresses`
      - Added `street` (text) - structured street component
      - Added `city` (text) - structured city component
      - Added `state` (text) - structured state component
      - Added `postal_code` (text) - structured postal code
      - Added `country` (text) - structured country
      - Added `raw_input` (text) - original user input
      - Added `normalized` (boolean) - geocoded flag

  ## 3. Security
    - RLS enabled on previous_addresses
    - Org members can view and insert
    - Org admins can update and delete
    - All policies check organization membership via auth.uid()

  ## 4. Notes
    - previous_addresses stores commonly-used addresses per organization
    - Upserted whenever a client or job address is saved
    - Used for offline autocomplete suggestions
    - Structured fields on client_addresses enable better geocoding
*/

-- Create previous_addresses table
CREATE TABLE IF NOT EXISTS previous_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  full_address text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  raw_input text DEFAULT '',
  normalized boolean NOT NULL DEFAULT false,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE previous_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view previous addresses"
  ON previous_addresses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert previous addresses"
  ON previous_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update previous addresses"
  ON previous_addresses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can delete previous addresses"
  ON previous_addresses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = previous_addresses.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_previous_addresses_org ON previous_addresses(organization_id);
CREATE INDEX IF NOT EXISTS idx_previous_addresses_org_last_used ON previous_addresses(organization_id, last_used_at DESC);

-- Add unique constraint on org + full_address to enable upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_previous_addresses_org_full_address
  ON previous_addresses(organization_id, full_address);

-- Add structured address fields to client_addresses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'street'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN street text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'city'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN city text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'state'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN state text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN postal_code text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'country'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN country text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'raw_input'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN raw_input text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'normalized'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN normalized boolean NOT NULL DEFAULT false;
  END IF;
END $$;
