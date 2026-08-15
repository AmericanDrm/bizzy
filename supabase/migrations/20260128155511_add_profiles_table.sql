/*
  # Add Profiles Table

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text)
      - `display_name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on profiles table
    - All authenticated users can view profiles
    - Users can update their own profile
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to handle new user signup - creates profile and role
CREATE OR REPLACE FUNCTION handle_new_user_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count integer;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_v2();

-- Backfill existing users with profiles and roles
DO $$
DECLARE
  existing_user RECORD;
  role_count integer;
BEGIN
  SELECT COUNT(*) INTO role_count FROM public.user_roles;
  
  FOR existing_user IN 
    SELECT id, email, created_at FROM auth.users 
    ORDER BY created_at ASC
  LOOP
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (existing_user.id, existing_user.email, split_part(existing_user.email, '@', 1))
    ON CONFLICT (id) DO NOTHING;

    IF role_count = 0 THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (existing_user.id, 'admin')
      ON CONFLICT (user_id) DO NOTHING;
      role_count := 1;
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (existing_user.id, 'user')
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
