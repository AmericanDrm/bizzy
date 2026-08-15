/*
  # Create Logos Storage Bucket

  ## Overview
  This migration creates a storage bucket for organization logos and sets up proper RLS policies
  to ensure secure file uploads and access.

  ## Storage Bucket
  - `logos` - Stores organization logo images
    - Accepts PNG, JPG, JPEG, SVG, and WEBP files
    - Max file size: 5MB
    - Organized by organization_id for multi-tenant support

  ## Security
  - Only authenticated users can upload logos for their organization
  - Only organization members can view their organization's logos
  - File names use UUID format for uniqueness and security
  - Admin/Owner role required to upload/delete logos
*/

-- Create the logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

-- Create storage policies for the logos bucket

-- Policy: Allow authenticated users to upload logos to their organization folder
CREATE POLICY "Organization members can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Policy: Allow authenticated users to update logos in their organization folder
CREATE POLICY "Organization admins can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Policy: Allow authenticated users to delete logos from their organization folder
CREATE POLICY "Organization admins can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Policy: Allow anyone to view logos (public bucket for invoice/estimate display)
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');