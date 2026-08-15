/*
  # Create Route Optimization Tables

  1. New Tables
    - `route_templates`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `name` (text) - User-defined route name
      - `description` (text) - Optional description
      - `total_distance` (decimal) - Total distance in miles
      - `total_duration` (integer) - Total duration in minutes
      - `optimized_at` (timestamptz) - When the route was optimized
      - `scheduled_date` (date, nullable) - If scheduled
      - `scheduled_time` (text, nullable) - If scheduled
      - `assigned_to` (uuid, nullable) - Team member assigned
      - `status` (text) - draft, scheduled, completed
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `route_stops`
      - `id` (uuid, primary key)
      - `route_template_id` (uuid, references route_templates)
      - `stop_order` (integer) - Order in the optimized sequence
      - `client_id` (uuid, nullable, references clients)
      - `client_address_id` (uuid, nullable, references client_addresses)
      - `label` (text) - Display label for the stop
      - `address` (text) - Full address string
      - `latitude` (decimal)
      - `longitude` (decimal)
      - `estimated_arrival` (text, nullable) - Estimated arrival time
      - `duration_at_stop` (integer) - Minutes to spend at stop
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

    - `route_optimization_runs`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `user_id` (uuid, references auth.users)
      - `location_count` (integer) - Number of locations optimized
      - `optimization_method` (text) - Algorithm used
      - `total_distance` (decimal)
      - `total_duration` (integer)
      - `run_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Organization members can view/create/update their org's routes
    - Only creators and admins can delete routes
*/

-- Create route_templates table
CREATE TABLE IF NOT EXISTS public.route_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  total_distance decimal(10,2) DEFAULT 0,
  total_duration integer DEFAULT 0,
  optimized_at timestamptz DEFAULT now(),
  scheduled_date date,
  scheduled_time text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create route_stops table
CREATE TABLE IF NOT EXISTS public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_template_id uuid NOT NULL REFERENCES public.route_templates(id) ON DELETE CASCADE,
  stop_order integer NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_address_id uuid REFERENCES public.client_addresses(id) ON DELETE SET NULL,
  label text NOT NULL,
  address text NOT NULL,
  latitude decimal(10,7) NOT NULL,
  longitude decimal(10,7) NOT NULL,
  estimated_arrival text,
  duration_at_stop integer DEFAULT 30,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create route_optimization_runs table
CREATE TABLE IF NOT EXISTS public.route_optimization_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_count integer NOT NULL,
  optimization_method text NOT NULL DEFAULT 'nearest_neighbor',
  total_distance decimal(10,2),
  total_duration integer,
  run_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_route_templates_org_id ON public.route_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_route_templates_created_by ON public.route_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_route_templates_status ON public.route_templates(status);
CREATE INDEX IF NOT EXISTS idx_route_templates_scheduled_date ON public.route_templates(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON public.route_stops(route_template_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_client_id ON public.route_stops(client_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order ON public.route_stops(route_template_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_route_optimization_runs_org_id ON public.route_optimization_runs(organization_id);

-- Enable RLS
ALTER TABLE public.route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_optimization_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for route_templates
CREATE POLICY "Organization members can view route templates"
  ON public.route_templates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = route_templates.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organization members can create route templates"
  ON public.route_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = route_templates.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organization members can update route templates"
  ON public.route_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = route_templates.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = route_templates.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Route creators and admins can delete route templates"
  ON public.route_templates FOR DELETE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = route_templates.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

-- RLS Policies for route_stops
CREATE POLICY "Organization members can view route stops"
  ON public.route_stops FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_templates
      JOIN public.organization_members ON organization_members.organization_id = route_templates.organization_id
      WHERE route_templates.id = route_stops.route_template_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organization members can create route stops"
  ON public.route_stops FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.route_templates
      JOIN public.organization_members ON organization_members.organization_id = route_templates.organization_id
      WHERE route_templates.id = route_stops.route_template_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organization members can update route stops"
  ON public.route_stops FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_templates
      JOIN public.organization_members ON organization_members.organization_id = route_templates.organization_id
      WHERE route_templates.id = route_stops.route_template_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.route_templates
      JOIN public.organization_members ON organization_members.organization_id = route_templates.organization_id
      WHERE route_templates.id = route_stops.route_template_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organization members can delete route stops"
  ON public.route_stops FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.route_templates
      JOIN public.organization_members ON organization_members.organization_id = route_templates.organization_id
      WHERE route_templates.id = route_stops.route_template_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- RLS Policies for route_optimization_runs
CREATE POLICY "Organization members can view optimization runs"
  ON public.route_optimization_runs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = route_optimization_runs.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organization members can create optimization runs"
  ON public.route_optimization_runs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = route_optimization_runs.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );
