/*
  # Auto-confirm new user emails on signup

  1. Changes
    - Creates a trigger function `auto_confirm_email` on `auth.users`
    - Sets `email_confirmed_at = now()` for every newly inserted user
    - This prevents users from being locked out when email confirmation
      is enabled in the Supabase dashboard

  2. Important Notes
    - The trigger runs BEFORE INSERT so the row is already confirmed
      when Supabase processes the signup response
    - This ensures `signUp()` returns a valid session immediately
*/

CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.email_confirmed_at := coalesce(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'auto_confirm_email_trigger'
  ) THEN
    CREATE TRIGGER auto_confirm_email_trigger
      BEFORE INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.auto_confirm_email();
  END IF;
END $$;
