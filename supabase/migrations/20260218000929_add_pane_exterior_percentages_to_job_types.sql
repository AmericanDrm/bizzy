/*
  # Add exterior percentage settings to job_types for pane-based job types

  ## Summary
  Adds two percentage columns to `job_types` that control how the total
  pane count for Standard and French pane styles is split between Exterior
  and Interior when scoping a job to "Exterior Only".

  ## New Columns on job_types
  - `exterior_pct_standard` (numeric 5,2, nullable) — what % of total Standard
    panes are Exterior (e.g. 60 = 60%). The remainder after subtracting
    Divisionals becomes Interior.
  - `exterior_pct_french` (numeric 5,2, nullable) — same concept for French panes.

  ## Notes
  - Only meaningful when `unit_of_measure = 'pane'`
  - NULL means no auto-split is configured (user enters values manually)
  - Storm panes do not have an exterior-only split — there is only "total" for storms
  - These percentages apply at the Job level when "Exterior Only" scope is chosen:
      exterior_count = round(total * exterior_pct / 100)
      interior_count = total - divisional - exterior_count
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_types' AND column_name = 'exterior_pct_standard'
  ) THEN
    ALTER TABLE public.job_types
      ADD COLUMN exterior_pct_standard numeric(5,2) DEFAULT NULL,
      ADD COLUMN exterior_pct_french   numeric(5,2) DEFAULT NULL;
  END IF;
END $$;
