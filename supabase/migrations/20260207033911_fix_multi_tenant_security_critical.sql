/*
  # Fix Critical Multi-Tenant Security Issues
  
  1. RLS Policy Fixes
    - Remove dangerous USING(true) policies that allow cross-organization data access
    - Ensure all policies properly check organization_id for multi-tenant isolation
  
  2. Profile Visibility
    - Restrict profile visibility to organization members only
  
  3. Business Settings
    - Restrict business settings to organization members
  
  ## Security Notes
  - This migration addresses CRITICAL security vulnerabilities
  - Prevents data leakage between organizations
  - Ensures proper multi-tenant isolation
*/

-- =====================================================
-- 1. FIX PROFILE POLICIES - RESTRICT TO ORGANIZATION
-- =====================================================

-- Drop the dangerous "view all profiles" policy
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Create restricted policy that only allows viewing profiles within the same organization
CREATE POLICY "Users can view org member profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om1
      INNER JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = (select auth.uid())
      AND om2.user_id = profiles.id
    )
  );

-- =====================================================
-- 2. VERIFY INVOICES & ESTIMATES POLICIES ARE CORRECT
-- =====================================================

-- Drop any legacy dangerous policies if they exist
DROP POLICY IF EXISTS "Users can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view all estimates" ON estimates;
DROP POLICY IF EXISTS "Users can update estimates" ON estimates;
DROP POLICY IF EXISTS "Users can delete estimates" ON estimates;

-- Ensure correct organization-scoped policies exist
DO $$
BEGIN
  -- Check if the correct policies exist, if not create them
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'invoices' 
    AND policyname = 'Organization members can view invoices'
  ) THEN
    CREATE POLICY "Organization members can view invoices"
      ON invoices
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = invoices.organization_id
          AND organization_members.user_id = (select auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'estimates' 
    AND policyname = 'Organization members can view estimates'
  ) THEN
    CREATE POLICY "Organization members can view estimates"
      ON estimates
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.organization_id = estimates.organization_id
          AND organization_members.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- =====================================================
-- 3. FIX BUSINESS SETTINGS POLICY
-- =====================================================

DROP POLICY IF EXISTS "All authenticated users can view business settings" ON business_settings;

CREATE POLICY "Users can view own org business settings"
  ON business_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = business_settings.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 4. ADD ORGANIZATION_ID TO PUSH_TOKENS IF MISSING
-- =====================================================

DO $$
BEGIN
  -- Check if organization_id column exists in push_tokens
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'push_tokens' 
    AND column_name = 'organization_id'
  ) THEN
    -- Add the column
    ALTER TABLE push_tokens ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- Populate existing rows with organization_id from user's membership
    UPDATE push_tokens pt
    SET organization_id = (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = pt.user_id
      LIMIT 1
    )
    WHERE organization_id IS NULL;
    
    -- Make it NOT NULL after population
    ALTER TABLE push_tokens ALTER COLUMN organization_id SET NOT NULL;
    
    -- Add index
    CREATE INDEX IF NOT EXISTS idx_push_tokens_org_id ON push_tokens(organization_id);
  END IF;
END $$;

-- Update push_tokens policies to check organization_id
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON push_tokens;

CREATE POLICY "Users can view org push tokens"
  ON push_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = push_tokens.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert org push tokens"
  ON push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = push_tokens.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update org push tokens"
  ON push_tokens
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = push_tokens.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = push_tokens.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete org push tokens"
  ON push_tokens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = push_tokens.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 5. ADD ORGANIZATION_ID TO PUSH_NOTIFICATIONS IF MISSING
-- =====================================================

DO $$
BEGIN
  -- Check if organization_id column exists in push_notifications
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'push_notifications' 
    AND column_name = 'organization_id'
  ) THEN
    -- Add the column
    ALTER TABLE push_notifications ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    
    -- Populate existing rows with organization_id from user's membership
    UPDATE push_notifications pn
    SET organization_id = (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = pn.user_id
      LIMIT 1
    )
    WHERE organization_id IS NULL;
    
    -- Make it NOT NULL after population
    ALTER TABLE push_notifications ALTER COLUMN organization_id SET NOT NULL;
    
    -- Add index
    CREATE INDEX IF NOT EXISTS idx_push_notifications_org_id ON push_notifications(organization_id);
  END IF;
END $$;

-- Update push_notifications policies to check organization_id
DROP POLICY IF EXISTS "Users can view own push notifications" ON push_notifications;
DROP POLICY IF EXISTS "Users can update own push notifications" ON push_notifications;

CREATE POLICY "Users can view org push notifications"
  ON push_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = push_notifications.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update org push notifications"
  ON push_notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = push_notifications.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = push_notifications.organization_id
      AND organization_members.user_id = (select auth.uid())
    )
  );