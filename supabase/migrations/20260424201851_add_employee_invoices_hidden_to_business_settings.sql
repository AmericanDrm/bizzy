/*
  # Add employee_invoices_hidden to business_settings

  ## Summary
  Adds a boolean flag that org owners can enable to prevent employees (members)
  from accessing the Invoices tab. Owners and admins are always unaffected.

  ## Changes
  - `business_settings`: new column `employee_invoices_hidden` (boolean, default false)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'employee_invoices_hidden'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN employee_invoices_hidden boolean DEFAULT false NOT NULL;
  END IF;
END $$;
