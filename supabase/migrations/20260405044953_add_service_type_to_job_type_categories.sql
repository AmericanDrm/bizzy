/*
  # Add service_type to job_type_categories

  ## Overview
  Adds a `service_type` column to `job_type_categories` so the estimate/invoice
  modals can determine which specialized UI panel to show when a job type from
  that category is selected.

  ## Changes

  ### Modified Tables
  - `job_type_categories`
    - `service_type` (text, nullable) — one of: 'window_cleaning', 'gutter_cleaning',
      'soft_washing', 'christmas_lights', 'pressure_washing', 'general'.
      NULL or 'general' = standard quantity stepper UI.
      'window_cleaning' = pane tally UI with add-on window type checkboxes.

  ## Notes
  - Existing rows get NULL (treated as 'general') — no data loss.
  - The CHECK constraint enforces valid values while still allowing NULL.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_type_categories' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE job_type_categories
      ADD COLUMN service_type text DEFAULT NULL
      CHECK (service_type IN (
        'window_cleaning',
        'gutter_cleaning',
        'soft_washing',
        'christmas_lights',
        'pressure_washing',
        'general'
      ));
  END IF;
END $$;
