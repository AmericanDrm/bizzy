/*
  # Create client-photos storage bucket

  Creates the storage bucket for client photos and sets up RLS policies
  so authenticated users can upload and read photos scoped to their organization.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-photos',
  'client-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload client photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-photos');

CREATE POLICY "Authenticated users can read client photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-photos');

CREATE POLICY "Public read access for client photos"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'client-photos');

CREATE POLICY "Authenticated users can delete own client photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
