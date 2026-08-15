/*
  # Organizations and Multi-Tenant Data Isolation - CRITICAL SECURITY FIX

  ## CRITICAL SECURITY FIX
  This migration implements proper data isolation between businesses/organizations.
*/

-- Step 1: Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT organizations_name_check CHECK (length(trim(name)) > 0)
);

-- Step 2: Create organization_members
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT organization_members_unique UNIQUE (organization_id, user_id)
);

-- Step 3: Add organization_id columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'organization_id') THEN
    ALTER TABLE clients ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'organization_id') THEN
    ALTER TABLE jobs ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_types' AND column_name = 'organization_id') THEN
    ALTER TABLE job_types ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_events' AND column_name = 'organization_id') THEN
    ALTER TABLE schedule_events ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'organization_id') THEN
    ALTER TABLE time_entries ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'organization_id') THEN
    ALTER TABLE notes ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'organization_id') THEN
    ALTER TABLE todos ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'organization_id') THEN
    ALTER TABLE invoices ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimates' AND column_name = 'organization_id') THEN
    ALTER TABLE estimates ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'income' AND column_name = 'organization_id') THEN
    ALTER TABLE income ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'organization_id') THEN
    ALTER TABLE expenses ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_templates' AND column_name = 'organization_id') THEN
    ALTER TABLE message_templates ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_photos' AND column_name = 'organization_id') THEN
    ALTER TABLE client_photos ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sent_messages' AND column_name = 'organization_id') THEN
    ALTER TABLE sent_messages ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_service_packages' AND column_name = 'organization_id') THEN
    ALTER TABLE job_service_packages ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_job_history' AND column_name = 'organization_id') THEN
    ALTER TABLE client_job_history ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'productivity_sessions' AND column_name = 'organization_id') THEN
    ALTER TABLE productivity_sessions ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'location_tracking' AND column_name = 'organization_id') THEN
    ALTER TABLE location_tracking ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'detected_locations' AND column_name = 'organization_id') THEN
    ALTER TABLE detected_locations ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clock_out_prompts' AND column_name = 'organization_id') THEN
    ALTER TABLE clock_out_prompts ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Migrate existing data
DO $$
DECLARE
  profile_record RECORD;
  new_org_id uuid;
  org_name text;
  org_slug text;
  slug_counter integer;
  job_type_record RECORD;
BEGIN
  -- Create organizations for each user
  FOR profile_record IN SELECT p.id, p.display_name, p.email FROM profiles p
  LOOP
    org_name := COALESCE(profile_record.display_name, 'User') || '''s Organization';
    org_slug := lower(regexp_replace(COALESCE(profile_record.display_name, 'user'), '[^a-z0-9]+', '-', 'gi')) || '-' || substr(profile_record.id::text, 1, 8);
    
    slug_counter := 0;
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
      slug_counter := slug_counter + 1;
      org_slug := lower(regexp_replace(COALESCE(profile_record.display_name, 'user'), '[^a-z0-9]+', '-', 'gi')) || '-' || substr(profile_record.id::text, 1, 8) || '-' || slug_counter;
    END LOOP;
    
    INSERT INTO organizations (id, name, slug, owner_id)
    VALUES (gen_random_uuid(), org_name, org_slug, profile_record.id)
    RETURNING id INTO new_org_id;
    
    -- Add user as organization owner
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (new_org_id, profile_record.id, 'owner');
    
    -- Migrate data for tables WITH user_id
    UPDATE clients SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE jobs SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE schedule_events SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE time_entries SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE notes SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE todos SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE invoices SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE estimates SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE income SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE expenses SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE message_templates SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE client_photos SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE sent_messages SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE job_service_packages SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE client_job_history SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE productivity_sessions SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE location_tracking SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE detected_locations SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    UPDATE clock_out_prompts SET organization_id = new_org_id WHERE user_id = profile_record.id AND organization_id IS NULL;
    
    -- Duplicate job_types for each organization (since they don't have user_id)
    FOR job_type_record IN SELECT * FROM job_types WHERE organization_id IS NULL
    LOOP
      INSERT INTO job_types (id, name, description, hourly_rate, is_active, unit_of_measure, custom_unit_label, is_flat_rate, organization_id, created_at, updated_at)
      VALUES (gen_random_uuid(), job_type_record.name, job_type_record.description, job_type_record.hourly_rate, job_type_record.is_active, job_type_record.unit_of_measure, job_type_record.custom_unit_label, job_type_record.is_flat_rate, new_org_id, job_type_record.created_at, job_type_record.updated_at)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  
  -- Delete original job_types that were duplicated
  DELETE FROM job_types WHERE organization_id IS NULL;
END $$;

-- Step 5: Make organization_id NOT NULL
ALTER TABLE clients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE job_types ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE schedule_events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE time_entries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE notes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE todos ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE estimates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE income ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE message_templates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE client_photos ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sent_messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE job_service_packages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE client_job_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE productivity_sessions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE location_tracking ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE detected_locations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE clock_out_prompts ALTER COLUMN organization_id SET NOT NULL;

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_organization_id ON jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_types_organization_id ON job_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_organization_id ON schedule_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_organization_id ON time_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_organization_id ON notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_todos_organization_id ON todos(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_estimates_organization_id ON estimates(organization_id);
CREATE INDEX IF NOT EXISTS idx_income_organization_id ON income(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_organization_id ON message_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_photos_organization_id ON client_photos(organization_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_organization_id ON sent_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_service_packages_organization_id ON job_service_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_job_history_organization_id ON client_job_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_productivity_sessions_organization_id ON productivity_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_location_tracking_organization_id ON location_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_detected_locations_organization_id ON detected_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_clock_out_prompts_organization_id ON clock_out_prompts(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);

-- Step 7: Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Step 8: Helper function
CREATE OR REPLACE FUNCTION user_is_org_member(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 9: Add organization policies
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Organization owners can update organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

CREATE POLICY "Users can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY "Organization owners can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );
