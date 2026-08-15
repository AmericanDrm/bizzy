/*
  # Add scope_options to job_type_categories

  ## Summary
  Adds a `scope_options` column to `job_type_categories` so that a category
  (e.g., "Window Cleaning") can declare that it offers both full service and
  exterior-only options. This enables the timer and manual time entry flows to
  show a scope selector when a category that supports multiple scopes is chosen.

  ## Changes
  - `job_type_categories.scope_options` (text, nullable)
    - NULL = no scope choice (single scope, no selector shown)
    - 'both' = full service AND exterior only are available (show selector)
    - 'exterior_only' = always exterior only (no selector, auto-set)

  ## Notes
  - Existing rows are left NULL (no scope options shown by default)
  - Backfills from job_types: if any job_type in a category has scope_options = 'both',
    that category gets scope_options = 'both'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_type_categories' AND column_name = 'scope_options'
  ) THEN
    ALTER TABLE public.job_type_categories ADD COLUMN scope_options text;
  END IF;
END $$;

-- Backfill: promote scope_options from job_types to their parent category
UPDATE public.job_type_categories jc
SET scope_options = 'both'
WHERE EXISTS (
  SELECT 1 FROM public.job_types jt
  WHERE jt.category_id = jc.id
  AND jt.scope_options = 'both'
)
AND jc.scope_options IS NULL;

UPDATE public.job_type_categories jc
SET scope_options = 'exterior_only'
WHERE EXISTS (
  SELECT 1 FROM public.job_types jt
  WHERE jt.category_id = jc.id
  AND jt.scope_options = 'exterior_only'
)
AND jc.scope_options IS NULL;
