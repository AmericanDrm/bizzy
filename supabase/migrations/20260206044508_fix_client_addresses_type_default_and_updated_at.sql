/*
  # Fix client_addresses type default and add updated_at

  1. Modified Tables
    - `client_addresses`
      - Set default value for `type` column to '' so inserts from code don't fail
      - Add `updated_at` column (timestamptz) for tracking address updates

  2. Important Notes
    - The code saves addresses without setting `type` (uses `label` instead)
    - The code writes `updated_at` on updates but the column didn't exist
*/

ALTER TABLE public.client_addresses ALTER COLUMN type SET DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'updated_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.client_addresses ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
