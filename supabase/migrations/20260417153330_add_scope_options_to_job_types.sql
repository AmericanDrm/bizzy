/*
  # Add `scope_options` column to job_types

  ## Summary
  Restores the `scope_options` column on `job_types` that several components
  (InvoiceModal, EstimateModal, JobModal, etc.) expect to query. Without this
  column, PostgREST returns an error for any SELECT that includes it, which
  presents to users as "No job types set up" even when job types exist.

  ## Changes
  1. Adds `scope_options` text column (nullable) to `public.job_types`.
     Allowed values: 'both' | 'exterior_only' | 'interior_only' | NULL.
  2. No default value set, so existing rows stay NULL (treated as "both" in UI).

  ## Security
  No RLS changes required — column inherits existing policies on the table.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'scope_options'
  ) THEN
    ALTER TABLE public.job_types ADD COLUMN scope_options text;
  END IF;
END $$;
