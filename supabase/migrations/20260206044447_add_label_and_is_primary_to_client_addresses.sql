/*
  # Add label and is_primary columns to client_addresses

  1. Modified Tables
    - `client_addresses`
      - `label` (text, default '') - display label for the address (e.g., "Home 1", "Office")
      - `is_primary` (boolean, default false) - whether this is the primary address for the client

  2. Data Migration
    - Copies existing `type` column values into `label` for any rows that exist
    - Sets first address per client as primary

  3. Important Notes
    - The code references label and is_primary but these columns were missing from the schema
    - This caused client fetching to fail with an error
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'label' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.client_addresses ADD COLUMN label text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'is_primary' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.client_addresses ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE public.client_addresses
SET label = type
WHERE label = '' AND type IS NOT NULL AND type != '';

UPDATE public.client_addresses ca
SET is_primary = true
WHERE ca.id = (
  SELECT id FROM public.client_addresses ca2
  WHERE ca2.client_id = ca.client_id
  ORDER BY created_at ASC
  LIMIT 1
);
