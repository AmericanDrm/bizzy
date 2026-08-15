/*
  # Disable auto-seed of starter job types for new organizations

  ## Summary
  Removes the trigger that automatically populates new organizations with default
  job type categories and job types. Organizations now start completely blank —
  admins/owners build their own service catalog from scratch.

  ## Changes
  - Drop trigger `trg_seed_starter_job_types` on `organizations`
  - The `seed_starter_job_types()` function is preserved (can still be called manually)
  - Existing organizations are unaffected — their data remains intact

  ## Rationale
  The system is designed so organization heads dynamically manage their own content.
  Pre-seeding generic starter data contradicts this design. Starting blank ensures
  every entry in the catalog is intentionally created by the admin.
*/

DROP TRIGGER IF EXISTS trg_seed_starter_job_types ON public.organizations;
