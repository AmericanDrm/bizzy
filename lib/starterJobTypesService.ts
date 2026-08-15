import { supabase } from './supabase';

export interface SeedResult {
  categoriesCreated: number;
  jobTypesCreated: number;
}

interface CategorySeed {
  name: string;
  color: string;
  service_type: string | null;
  sort_order: number;
  jobTypes: {
    name: string;
    hourly_rate: number;
    unit_of_measure: string;
    is_flat_rate: boolean;
  }[];
}

const STARTER_CATEGORIES: CategorySeed[] = [
  {
    name: 'Window Cleaning',
    color: '#0ea5e9',
    service_type: 'window_cleaning',
    sort_order: 0,
    jobTypes: [
      { name: 'Residential Window Cleaning', hourly_rate: 75, unit_of_measure: 'hour', is_flat_rate: false },
      { name: 'Commercial Window Cleaning', hourly_rate: 85, unit_of_measure: 'hour', is_flat_rate: false },
      { name: 'Screen Cleaning', hourly_rate: 50, unit_of_measure: 'hour', is_flat_rate: false },
    ],
  },
  {
    name: 'Gutter Cleaning',
    color: '#10b981',
    service_type: null,
    sort_order: 1,
    jobTypes: [
      { name: 'Gutter Cleaning', hourly_rate: 95, unit_of_measure: 'hour', is_flat_rate: false },
      { name: 'Gutter Guard Install', hourly_rate: 0, unit_of_measure: 'hour', is_flat_rate: true },
    ],
  },
  {
    name: 'Pressure Washing',
    color: '#f59e0b',
    service_type: null,
    sort_order: 2,
    jobTypes: [
      { name: 'Driveway Pressure Wash', hourly_rate: 0, unit_of_measure: 'hour', is_flat_rate: true },
      { name: 'House Pressure Wash', hourly_rate: 0, unit_of_measure: 'hour', is_flat_rate: true },
      { name: 'Concrete / Patio', hourly_rate: 0, unit_of_measure: 'hour', is_flat_rate: true },
    ],
  },
  {
    name: 'Soft Washing',
    color: '#06b6d4',
    service_type: null,
    sort_order: 3,
    jobTypes: [
      { name: 'Roof Soft Wash', hourly_rate: 0, unit_of_measure: 'hour', is_flat_rate: true },
      { name: 'House Soft Wash', hourly_rate: 0, unit_of_measure: 'hour', is_flat_rate: true },
    ],
  },
  {
    name: 'Christmas Lights',
    color: '#ef4444',
    service_type: null,
    sort_order: 4,
    jobTypes: [
      { name: 'Christmas Light Install', hourly_rate: 0, unit_of_measure: 'hour', is_flat_rate: true },
      { name: 'Christmas Light Takedown', hourly_rate: 0, unit_of_measure: 'hour', is_flat_rate: true },
    ],
  },
];

export async function seedStarterJobTypes(organizationId: string): Promise<SeedResult> {
  if (!organizationId) {
    throw new Error('Organization ID is required to seed starter job types');
  }

  const { data: existingCats } = await supabase
    .from('job_type_categories')
    .select('name')
    .eq('organization_id', organizationId);

  const existingCatNames = new Set((existingCats || []).map((c: any) => c.name.toLowerCase()));

  const { data: existingJts } = await supabase
    .from('job_types')
    .select('name')
    .eq('organization_id', organizationId);

  const existingJtNames = new Set((existingJts || []).map((j: any) => j.name.toLowerCase()));

  let categoriesCreated = 0;
  let jobTypesCreated = 0;

  for (const cat of STARTER_CATEGORIES) {
    let categoryId: string | null = null;

    if (!existingCatNames.has(cat.name.toLowerCase())) {
      const { data: inserted, error: catErr } = await supabase
        .from('job_type_categories')
        .insert({
          organization_id: organizationId,
          name: cat.name,
          color: cat.color,
          service_type: cat.service_type,
          sort_order: cat.sort_order,
        })
        .select('id')
        .maybeSingle();

      if (catErr) {
        console.error('Error inserting category', cat.name, catErr);
        continue;
      }

      categoryId = inserted?.id || null;
      if (categoryId) categoriesCreated += 1;
    } else {
      const { data: found } = await supabase
        .from('job_type_categories')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('name', cat.name)
        .maybeSingle();
      categoryId = (found as any)?.id || null;
    }

    if (!categoryId) continue;

    for (const jt of cat.jobTypes) {
      if (existingJtNames.has(jt.name.toLowerCase())) continue;

      const { error: jtErr } = await supabase
        .from('job_types')
        .insert({
          organization_id: organizationId,
          category_id: categoryId,
          name: jt.name,
          hourly_rate: jt.hourly_rate,
          unit_of_measure: jt.unit_of_measure,
          is_flat_rate: jt.is_flat_rate,
          is_active: true,
        });

      if (jtErr) {
        console.error('Error inserting job type', jt.name, jtErr);
        continue;
      }

      jobTypesCreated += 1;
    }
  }

  return { categoriesCreated, jobTypesCreated };
}
