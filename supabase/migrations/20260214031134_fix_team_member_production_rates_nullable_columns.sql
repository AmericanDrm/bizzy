/*
  # Fix team_member_production_rates nullable columns

  ## Overview
  The table was restructured to use `member_id` and `unit_type` instead of
  `user_id` and `job_type_id`, but the old columns still have NOT NULL
  constraints. This prevents new-style inserts from succeeding.

  ## Changes
  1. Make `user_id` nullable (replaced by `member_id`)
  2. Make `job_type_id` nullable (replaced by `unit_type`)

  ## Notes
  - Existing rows with `user_id` / `job_type_id` values are unaffected
  - New inserts use `member_id` and `unit_type` instead
*/

ALTER TABLE team_member_production_rates
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE team_member_production_rates
  ALTER COLUMN job_type_id DROP NOT NULL;
