/*
  # Fix Signup Failure - Message Templates Trigger

  1. Problem
    - The `create_default_message_templates` trigger fires on auth.users INSERT
    - It tries to insert into `message_templates` without providing `organization_id`
    - `organization_id` is NOT NULL, so the insert fails
    - This rolls back the entire auth.users INSERT, preventing any user from signing up

  2. Solution
    - Replace the trigger function with a no-op that simply returns NEW
    - Message templates will be created from the application after the user
      creates or joins an organization (when organization_id is available)

  3. Security Changes
    - None - this only affects the trigger behavior
*/

CREATE OR REPLACE FUNCTION create_default_message_templates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
