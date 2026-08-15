/*
  # Add PDF URL to Invoices and Estimates

  ## Overview
  Adds a pdf_url column to both invoices and estimates tables. This stores the
  public download URL of the PDF after it has been uploaded to Supabase Storage.
  The URL is included in emails/SMS so clients can download the PDF with one tap.

  ## Changes
  - `invoices` table: adds `pdf_url` (text, nullable) — stores public Storage URL
  - `estimates` table: adds `pdf_url` (text, nullable) — stores public Storage URL

  ## Notes
  - Column is nullable — existing records without a stored PDF are unaffected
  - URL is updated each time the document is sent (PDF may be regenerated)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE invoices ADD COLUMN pdf_url TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE estimates ADD COLUMN pdf_url TEXT;
  END IF;
END $$;
