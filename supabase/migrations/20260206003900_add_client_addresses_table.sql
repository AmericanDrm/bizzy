/*
  # Add Client Addresses Table

  1. New Tables
    - `client_addresses`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients)
      - `user_id` (uuid, references auth.users)
      - `label` (text) - e.g. "Home 1", "Business 2", "Custom Name"
      - `address` (text) - the full street address
      - `latitude` (numeric) - geocoded latitude
      - `longitude` (numeric) - geocoded longitude
      - `is_primary` (boolean) - whether this is the primary/default address
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `client_addresses` table
    - Add policies for authenticated users to manage their own client addresses

  3. Important Notes
    - Existing client address data in the `clients` table is preserved
    - This table allows multiple addresses per client with custom labels
    - Labels support Home 1-N, Business 1-N, and custom names
*/

CREATE TABLE IF NOT EXISTS client_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home 1',
  address text NOT NULL DEFAULT '',
  latitude numeric,
  longitude numeric,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own client addresses"
  ON client_addresses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client addresses"
  ON client_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own client addresses"
  ON client_addresses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own client addresses"
  ON client_addresses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_user_id ON client_addresses(user_id);
