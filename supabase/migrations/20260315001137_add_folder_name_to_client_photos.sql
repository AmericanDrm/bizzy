/*
  # Add folder_name to client_photos

  1. Changes
    - `client_photos` table: adds `folder_name` (text, nullable)
      Allows photos to be grouped into named folders per client.
      NULL means the photo is uncategorized / in "All Photos".

  2. Notes
    - No data migration needed; existing photos remain uncategorized (NULL).
    - Folder names are free-form strings; no separate folders table is required.
    - Indexes added for efficient filtering by (client_id, folder_name).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_photos' AND column_name = 'folder_name'
  ) THEN
    ALTER TABLE client_photos ADD COLUMN folder_name text DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_photos_client_folder
  ON client_photos (client_id, folder_name)
  WHERE is_deleted = false;
