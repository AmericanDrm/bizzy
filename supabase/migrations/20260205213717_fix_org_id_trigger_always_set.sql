/*
  # Fix Organization ID Trigger - Always Set From Auth Context

  1. Changes
    - Update `set_default_organization_id()` to ALWAYS set organization_id
      from the authenticated user's membership, not just when NULL
    - This ensures the correct org_id is always used regardless of what
      the client sends

  2. Important Notes
    - The trigger now overrides any client-provided organization_id
    - This prevents mismatches between the user's auth context and the org_id
    - Falls back to the provided value only if no membership is found
*/

CREATE OR REPLACE FUNCTION set_default_organization_id()
RETURNS TRIGGER AS $$
DECLARE
  resolved_org_id uuid;
BEGIN
  SELECT om.organization_id INTO resolved_org_id
  FROM organization_members om
  WHERE om.user_id = auth.uid()
  ORDER BY om.joined_at ASC
  LIMIT 1;

  IF resolved_org_id IS NOT NULL THEN
    NEW.organization_id := resolved_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
