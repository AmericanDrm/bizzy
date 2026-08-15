/*
  # Fix Function Search Path Mutable

  ## Summary
  Fixes the mutable search_path vulnerability in the update_location_audit_logs_updated_at function.
  Sets a fixed search_path to prevent potential search_path injection attacks.

  ## Changes
  - Recreates update_location_audit_logs_updated_at with SET search_path = ''
    and fully-qualified table references to prevent search_path manipulation
*/

CREATE OR REPLACE FUNCTION public.update_location_audit_logs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
