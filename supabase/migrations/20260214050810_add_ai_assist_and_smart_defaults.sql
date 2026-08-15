/*
  # AI Assist and Smart Defaults System

  1. New Tables
    - `job_type_defaults`
      - Stores smart default text templates for each job type
      - Includes descriptions, included items, notes, disclaimers, and materials
      - Used as fallback and base for AI enhancement
    
    - `ai_prompt_templates`
      - Stores reusable prompt templates for different use cases
      - Categories: job_description, estimate_notes, invoice_summary, client_message
    
    - `address_suggestions_cache`
      - Caches previously used addresses for faster autocomplete
      - Stores normalized addresses with coordinates
      - Used for offline address suggestions

  2. Security
    - Enable RLS on all new tables
    - Restrict access to authenticated users within their organization
    - Owner/Admin can manage defaults, all members can read

  3. Indexes
    - Add indexes for frequently queried columns
    - Optimize for autocomplete and template lookups
*/

-- Job Type Defaults Table
CREATE TABLE IF NOT EXISTS job_type_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_type_id uuid REFERENCES job_types(id) ON DELETE CASCADE,
  default_description text,
  default_included_items text,
  default_notes text,
  default_disclaimers text,
  default_materials_list text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE job_type_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view job type defaults"
  ON job_type_defaults FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = job_type_defaults.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert job type defaults"
  ON job_type_defaults FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = job_type_defaults.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update job type defaults"
  ON job_type_defaults FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = job_type_defaults.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = job_type_defaults.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete job type defaults"
  ON job_type_defaults FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = job_type_defaults.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Indexes for job_type_defaults
CREATE INDEX IF NOT EXISTS idx_job_type_defaults_org ON job_type_defaults(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_type_defaults_job_type ON job_type_defaults(job_type_id);

-- AI Prompt Templates Table
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('job_description', 'estimate_notes', 'invoice_summary', 'client_message', 'materials_list', 'disclaimers')),
  name text NOT NULL,
  prompt_template text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view AI prompt templates"
  ON ai_prompt_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = ai_prompt_templates.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage AI prompt templates"
  ON ai_prompt_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = ai_prompt_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = ai_prompt_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Indexes for ai_prompt_templates
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_org ON ai_prompt_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_category ON ai_prompt_templates(category);

-- Address Suggestions Cache Table
CREATE TABLE IF NOT EXISTS address_suggestions_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_address text NOT NULL,
  street text,
  city text,
  state text,
  postal_code text,
  country text DEFAULT 'United States',
  latitude numeric,
  longitude numeric,
  normalized boolean DEFAULT false,
  use_count integer DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE address_suggestions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view address cache"
  ON address_suggestions_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = address_suggestions_cache.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert address cache"
  ON address_suggestions_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = address_suggestions_cache.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update address cache"
  ON address_suggestions_cache FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = address_suggestions_cache.organization_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = address_suggestions_cache.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Indexes for address_suggestions_cache
CREATE INDEX IF NOT EXISTS idx_address_cache_org ON address_suggestions_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_address_cache_search ON address_suggestions_cache USING gin(to_tsvector('english', full_address));
CREATE INDEX IF NOT EXISTS idx_address_cache_last_used ON address_suggestions_cache(organization_id, last_used_at DESC);

-- Insert default AI prompt templates
INSERT INTO ai_prompt_templates (organization_id, category, name, prompt_template, variables, is_default)
SELECT 
  id,
  'job_description',
  'Standard Job Description',
  'Write a friendly and professional job description for {job_type}. Include what is typically included in this service.',
  '["job_type"]'::jsonb,
  true
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO ai_prompt_templates (organization_id, category, name, prompt_template, variables, is_default)
SELECT 
  id,
  'estimate_notes',
  'Standard Estimate Notes',
  'Write professional notes for an estimate for {job_type}. Mention key details and set expectations.',
  '["job_type"]'::jsonb,
  true
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO ai_prompt_templates (organization_id, category, name, prompt_template, variables, is_default)
SELECT 
  id,
  'invoice_summary',
  'Standard Work Summary',
  'Summarize the work performed: {work_items}. Make it professional and clear.',
  '["work_items"]'::jsonb,
  true
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO ai_prompt_templates (organization_id, category, name, prompt_template, variables, is_default)
SELECT 
  id,
  'client_message',
  'Standard Client Message',
  'Draft a friendly message to a client about {topic}. Keep it professional and courteous.',
  '["topic"]'::jsonb,
  true
FROM organizations
ON CONFLICT DO NOTHING;
