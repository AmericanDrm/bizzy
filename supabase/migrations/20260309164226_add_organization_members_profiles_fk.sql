/*
  # Add foreign key from organization_members to profiles

  1. Changes
    - Add foreign key constraint from `organization_members.user_id` to `profiles.id`
    - This enables PostgREST to resolve joins between organization_members and profiles

  2. Important Notes
    - Required for Supabase client `.select('profiles(...)') ` syntax to work
    - Uses IF NOT EXISTS pattern via DO block for safety
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_members_user_id_profiles_fkey'
      AND table_name = 'organization_members'
  ) THEN
    ALTER TABLE organization_members
      ADD CONSTRAINT organization_members_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id_profiles
  ON organization_members(user_id);
