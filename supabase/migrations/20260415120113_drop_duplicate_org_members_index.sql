/*
  # Drop Duplicate Index on organization_members

  Removes the duplicate index idx_organization_members_user_id_profiles which is identical
  to idx_organization_members_user_id. Keeping the original.
*/

DROP INDEX IF EXISTS public.idx_organization_members_user_id_profiles;
