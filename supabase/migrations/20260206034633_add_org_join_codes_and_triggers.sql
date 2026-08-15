/*
  # Add Organization Join Codes and Auto-Set Organization ID Triggers

  1. Changes
    - Add `join_code` column to `organizations` (unique 6-digit numeric code)
    - Create function to generate unique 6-digit codes
    - Backfill existing organizations with codes
    - Create `join_organization_by_code` SECURITY DEFINER function for employee signup
    - Attach `set_default_organization_id` trigger to ALL tenant tables
      (fixes RLS violations when client code omits organization_id)
    - Fix organization_members INSERT policy for new org owner self-insert

  2. New Columns
    - `organizations.join_code` (text, unique, not null) - 6-digit code for employees to join

  3. New Functions
    - `generate_org_join_code()` - generates unique 6-digit numeric codes
    - `join_organization_by_code(p_join_code text)` - allows authenticated users to join an org by code
    - `set_org_join_code()` - trigger function to auto-generate code on org creation

  4. Security
    - join_organization_by_code is SECURITY DEFINER (bypasses RLS for self-join)
    - set_default_organization_id trigger ensures org_id is always resolved from membership
    - Updated INSERT policy on organization_members to allow new org owners to add themselves
*/

-- Add join_code column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'join_code'
  ) THEN
    ALTER TABLE organizations ADD COLUMN join_code text UNIQUE;
  END IF;
END $$;

-- Function to generate unique 6-digit numeric code
CREATE OR REPLACE FUNCTION generate_org_join_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := lpad(floor(random() * 1000000)::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM organizations WHERE join_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Backfill existing organizations with join codes
UPDATE organizations SET join_code = generate_org_join_code() WHERE join_code IS NULL;

-- Make join_code NOT NULL
DO $$
BEGIN
  ALTER TABLE organizations ALTER COLUMN join_code SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Auto-generate join_code on org creation
CREATE OR REPLACE FUNCTION set_org_join_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    NEW.join_code := generate_org_join_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_org_join_code ON organizations;
CREATE TRIGGER trigger_set_org_join_code
  BEFORE INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_org_join_code();

-- Function for employees to join an organization by code
CREATE OR REPLACE FUNCTION join_organization_by_code(p_join_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
  v_user_id uuid;
  v_existing_member uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, name INTO v_org_id, v_org_name
  FROM organizations
  WHERE join_code = trim(p_join_code);

  IF v_org_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid organization code');
  END IF;

  SELECT id INTO v_existing_member
  FROM organization_members
  WHERE organization_id = v_org_id AND user_id = v_user_id;

  IF v_existing_member IS NOT NULL THEN
    RETURN json_build_object('success', true, 'organization_id', v_org_id, 'organization_name', v_org_name, 'already_member', true);
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'member');

  RETURN json_build_object('success', true, 'organization_id', v_org_id, 'organization_name', v_org_name, 'already_member', false);
END;
$$;

-- Ensure set_default_organization_id function exists and is correct
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

-- Attach trigger to ALL tenant tables that require organization_id
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clients', 'jobs', 'job_types', 'schedule_events', 'time_entries',
      'notes', 'todos', 'invoices', 'estimates', 'income', 'expenses',
      'message_templates', 'client_photos', 'sent_messages',
      'job_service_packages', 'client_job_history', 'productivity_sessions',
      'location_tracking', 'detected_locations', 'clock_out_prompts', 'work_orders'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trigger_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_organization_id()',
      tbl
    );
  END LOOP;
END $$;

-- Fix organization_members INSERT policy
-- New org owners need to add themselves during signup
DROP POLICY IF EXISTS "Admins can insert organization members" ON organization_members;

CREATE POLICY "Org owners and admins can insert members"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_is_org_owner(organization_id)
    OR auth_user_is_org_admin(organization_id)
  );

-- Create index on join_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_organizations_join_code ON organizations(join_code);
