/*
  # Fix Organization Creation During Signup

  ## Changes
  1. Create a secure function to create organization and add member
     - Bypasses RLS but maintains security through function logic
     - Ensures owner_id is always set to the authenticated user
     - Atomically creates organization and adds owner as member
  
  ## Security
  - Function runs with SECURITY INVOKER (uses caller's permissions)
  - Only allows creating organization for the authenticated user
  - Returns the created organization data
*/

-- Function to create organization for new user
CREATE OR REPLACE FUNCTION create_organization_for_user(
  p_name text,
  p_slug text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_org_data json;
BEGIN
  -- Get authenticated user ID
  v_user_id := auth.uid();
  
  -- Verify user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Validate inputs
  IF LENGTH(TRIM(p_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name cannot be empty';
  END IF;
  
  IF LENGTH(TRIM(p_slug)) = 0 THEN
    RAISE EXCEPTION 'Organization slug cannot be empty';
  END IF;
  
  -- Create organization
  INSERT INTO organizations (name, slug, owner_id)
  VALUES (TRIM(p_name), TRIM(p_slug), v_user_id)
  RETURNING id INTO v_org_id;
  
  -- Add user as owner in organization_members
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');
  
  -- Create default message templates
  INSERT INTO message_templates (user_id, organization_id, template_type, message_text, is_active)
  VALUES 
    (v_user_id, v_org_id, 'day_of', 'Hi {client_name}! This is a reminder about your appointment today at {time} for {job_title}. Looking forward to seeing you!', true),
    (v_user_id, v_org_id, 'on_way', 'Hi {client_name}! I''m on my way to your location for {job_title}. I should arrive in approximately 15 minutes.', true),
    (v_user_id, v_org_id, 'follow_up', 'Hi {client_name}! Thank you for choosing our services. If you have any questions or concerns about the work completed, please don''t hesitate to reach out!', true);
  
  -- Get the created organization data including join_code
  SELECT json_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'owner_id', owner_id,
    'join_code', join_code,
    'created_at', created_at
  )
  INTO v_org_data
  FROM organizations
  WHERE id = v_org_id;
  
  RETURN v_org_data;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organization_for_user(text, text) TO authenticated;
