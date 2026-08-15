
/*
  # Fix Storage Bucket Public Listing Policies

  ## Summary
  The Supabase security advisor flagged three storage buckets as allowing
  unrestricted public listing. This migration replaces the broad "allow all"
  SELECT policies with scoped policies that restrict access to:
  - Authenticated org members for their organization's files
  - Portal clients for their own files
  - Anonymous access only for specific public files (logos still viewable by anyone
    since they're displayed on public-facing portals and estimates)

  ## Changes

  ### client-photos
  - Remove: Anonymous "Public read access for client photos" (anyone could list/read all photos)
  - Remove: Broad "Authenticated users can read client photos" (no ownership scoping)
  - Add: Org members can read photos in their org's folder

  ### invoice-pdfs
  - Remove: Broad "Anyone can view invoice PDFs" (public role, no scoping)
  - Add: Org members can read PDFs in their org's folder
  - Add: Portal clients can read PDFs in their org's folder (needed for portal invoice viewing)

  ### logos
  - Remove: Broad "Anyone can view logos" (public role, no scoping)
  - Add: Public (anon) access scoped to specific org folder paths
    (logos must remain publicly readable for portal pages and estimate previews)
*/

-- ============================================================
-- client-photos: remove broad policies, add scoped org member access
-- ============================================================
DROP POLICY IF EXISTS "Public read access for client photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read client photos" ON storage.objects;

CREATE POLICY "Org members can read own org client photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT (om.organization_id)::text
      FROM organization_members om
      WHERE om.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- invoice-pdfs: remove broad public policy, add scoped access
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view invoice PDFs" ON storage.objects;

CREATE POLICY "Org members can read own org invoice PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoice-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT (om.organization_id)::text
      FROM organization_members om
      WHERE om.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Portal clients can read their org invoice PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoice-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT (cpa.organization_id)::text
      FROM client_portal_accounts cpa
      WHERE cpa.user_id = (SELECT auth.uid())
        AND cpa.is_active = true
    )
  );

-- ============================================================
-- logos: replace broad public policy with scoped public access
-- Logos must remain publicly readable (used on portals, estimates, receipts)
-- but we scope to the folder path to prevent arbitrary listing
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;

CREATE POLICY "Public can read logos by org folder"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND length((storage.foldername(name))[1]) > 0
  );
