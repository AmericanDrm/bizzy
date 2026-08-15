/*
  # Auto-seed starter categories and job types on new organization

  ## Summary
  Ensures every newly created organization is automatically populated with a starter
  pack of job type categories (Window Cleaning, Gutter Cleaning, Pressure Washing,
  Soft Washing, Christmas Lights) and common job types under each category. This
  eliminates the "No job types set up" empty state for new organizations.

  ## Changes
  1. New Function: `seed_starter_job_types(p_org_id uuid)` — inserts default
     categories and job types for a given organization. Safe to call multiple
     times (skips names that already exist).
  2. New Trigger: `trg_seed_starter_job_types` on `organizations` AFTER INSERT —
     calls the seeding function for every newly created organization.
  3. Backfill: Calls the seeding function for all existing organizations that
     currently have zero categories and zero job types.

  ## Security
  Function runs as SECURITY DEFINER so it can bypass RLS during the trigger
  execution. Search path is pinned to `public` to avoid hijacking.
*/

CREATE OR REPLACE FUNCTION public.seed_starter_job_types(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_window uuid;
  v_cat_gutter uuid;
  v_cat_pressure uuid;
  v_cat_soft uuid;
  v_cat_xmas uuid;
BEGIN
  IF p_org_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_cat_window FROM public.job_type_categories
    WHERE organization_id = p_org_id AND lower(name) = lower('Window Cleaning') LIMIT 1;
  IF v_cat_window IS NULL THEN
    INSERT INTO public.job_type_categories (organization_id, name, color, service_type, sort_order)
    VALUES (p_org_id, 'Window Cleaning', '#0ea5e9', 'window_cleaning', 0)
    RETURNING id INTO v_cat_window;
  END IF;

  SELECT id INTO v_cat_gutter FROM public.job_type_categories
    WHERE organization_id = p_org_id AND lower(name) = lower('Gutter Cleaning') LIMIT 1;
  IF v_cat_gutter IS NULL THEN
    INSERT INTO public.job_type_categories (organization_id, name, color, service_type, sort_order)
    VALUES (p_org_id, 'Gutter Cleaning', '#10b981', NULL, 1)
    RETURNING id INTO v_cat_gutter;
  END IF;

  SELECT id INTO v_cat_pressure FROM public.job_type_categories
    WHERE organization_id = p_org_id AND lower(name) = lower('Pressure Washing') LIMIT 1;
  IF v_cat_pressure IS NULL THEN
    INSERT INTO public.job_type_categories (organization_id, name, color, service_type, sort_order)
    VALUES (p_org_id, 'Pressure Washing', '#f59e0b', NULL, 2)
    RETURNING id INTO v_cat_pressure;
  END IF;

  SELECT id INTO v_cat_soft FROM public.job_type_categories
    WHERE organization_id = p_org_id AND lower(name) = lower('Soft Washing') LIMIT 1;
  IF v_cat_soft IS NULL THEN
    INSERT INTO public.job_type_categories (organization_id, name, color, service_type, sort_order)
    VALUES (p_org_id, 'Soft Washing', '#06b6d4', NULL, 3)
    RETURNING id INTO v_cat_soft;
  END IF;

  SELECT id INTO v_cat_xmas FROM public.job_type_categories
    WHERE organization_id = p_org_id AND lower(name) = lower('Christmas Lights') LIMIT 1;
  IF v_cat_xmas IS NULL THEN
    INSERT INTO public.job_type_categories (organization_id, name, color, service_type, sort_order)
    VALUES (p_org_id, 'Christmas Lights', '#ef4444', NULL, 4)
    RETURNING id INTO v_cat_xmas;
  END IF;

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_window, 'Residential Window Cleaning', 75, 'hour', false, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Residential Window Cleaning'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_window, 'Commercial Window Cleaning', 85, 'hour', false, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Commercial Window Cleaning'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_window, 'Screen Cleaning', 50, 'hour', false, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Screen Cleaning'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_gutter, 'Gutter Cleaning', 95, 'hour', false, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Gutter Cleaning'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_gutter, 'Gutter Guard Install', 0, 'hour', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Gutter Guard Install'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_pressure, 'Driveway Pressure Wash', 0, 'hour', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Driveway Pressure Wash'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_pressure, 'House Pressure Wash', 0, 'hour', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('House Pressure Wash'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_pressure, 'Concrete / Patio', 0, 'hour', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Concrete / Patio'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_soft, 'Roof Soft Wash', 0, 'hour', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Roof Soft Wash'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_soft, 'House Soft Wash', 0, 'hour', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('House Soft Wash'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_xmas, 'Christmas Light Install', 0, 'hour', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Christmas Light Install'));

  INSERT INTO public.job_types (organization_id, category_id, name, hourly_rate, unit_of_measure, is_flat_rate, is_active)
  SELECT p_org_id, v_cat_xmas, 'Christmas Light Takedown', 0, 'hour', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.job_types WHERE organization_id = p_org_id AND lower(name) = lower('Christmas Light Takedown'));
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_seed_starter_job_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_starter_job_types(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_starter_job_types ON public.organizations;
CREATE TRIGGER trg_seed_starter_job_types
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_seed_starter_job_types();

DO $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN
    SELECT o.id FROM public.organizations o
    WHERE NOT EXISTS (SELECT 1 FROM public.job_type_categories c WHERE c.organization_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM public.job_types j WHERE j.organization_id = o.id)
  LOOP
    PERFORM public.seed_starter_job_types(v_org.id);
  END LOOP;
END $$;
