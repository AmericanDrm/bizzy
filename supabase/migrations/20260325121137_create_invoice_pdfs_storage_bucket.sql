/*
  # Create Invoice PDFs Storage Bucket

  ## Overview
  Creates a public storage bucket for storing generated invoice and estimate PDF files.
  PDFs are uploaded here when sending via native email/SMS so a download link can be
  included in the message body — solving the email attachment limitation on web.

  ## Storage Bucket
  - `invoice-pdfs` - Stores generated PDF files for invoices and estimates
    - Accepts PDF files only
    - Max file size: 20MB
    - Organized by organization_id/type/document_id.pdf
    - Public read access (clients need to open without authenticating)

  ## Security
  - Authenticated organization members can upload PDFs
  - Anyone (including unauthenticated clients) can read/download PDFs via public URL
  - Only organization members can delete their own PDFs
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-pdfs',
  'invoice-pdfs',
  true,
  20971520,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf'];

CREATE POLICY "Organization members can upload invoice PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update invoice PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can delete invoice PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view invoice PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoice-pdfs');
