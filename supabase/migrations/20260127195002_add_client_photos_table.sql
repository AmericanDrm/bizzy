/*
  # Add Client Photos Table

  ## Overview
  Creates a table to store photos associated with clients, allowing users to keep
  visual records related to their clients (e.g., project photos, before/after shots).

  ## New Tables

  ### client_photos
  Stores photo URLs and metadata for client profiles
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Links to authenticated user
  - `client_id` (uuid) - Links to the client
  - `photo_url` (text) - URL of the photo
  - `caption` (text) - Optional description of the photo
  - `created_at` (timestamptz) - When the photo was added

  ## Security
  - RLS enabled with policies for authenticated users
  - Users can only access photos for their own clients
*/

CREATE TABLE IF NOT EXISTS client_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_photos_client_id ON client_photos(client_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_user_id ON client_photos(user_id);

ALTER TABLE client_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own client photos"
  ON client_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client photos"
  ON client_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own client photos"
  ON client_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);