import { supabase } from './supabase';
import type { DocumentTemplate } from './documentTemplateTypes';
import { buildDefaultTemplate } from './documentTemplateTypes';

const cache: Record<string, DocumentTemplate | null> = {};

function cacheKey(orgId: string, type: string) {
  return `${orgId}:${type}`;
}

export function invalidateCache(orgId: string, type: 'invoice' | 'estimate') {
  delete cache[cacheKey(orgId, type)];
}

export async function fetchActiveTemplate(
  orgId: string,
  type: 'invoice' | 'estimate'
): Promise<DocumentTemplate | null> {
  const key = cacheKey(orgId, type);
  if (key in cache) return cache[key];

  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('type', type)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    cache[key] = null;
    return null;
  }

  if (!data) {
    const def = buildDefaultTemplate(orgId, type);
    const { data: created, error: createError } = await supabase
      .from('document_templates')
      .insert(def)
      .select()
      .single();
    if (createError) {
      cache[key] = null;
      return null;
    }
    cache[key] = created as DocumentTemplate;
    return cache[key];
  }

  cache[key] = data as DocumentTemplate;
  return cache[key];
}

export async function fetchAllTemplates(
  orgId: string,
  type: 'invoice' | 'estimate'
): Promise<DocumentTemplate[]> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('type', type)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []) as DocumentTemplate[];
}

export async function saveTemplate(template: DocumentTemplate): Promise<DocumentTemplate | null> {
  const { data, error } = await supabase
    .from('document_templates')
    .update({
      name: template.name,
      accent_color: template.accent_color,
      accent_light_color: template.accent_light_color,
      blocks: template.blocks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', template.id)
    .select()
    .single();

  if (error) return null;
  invalidateCache(template.organization_id, template.type);
  return data as DocumentTemplate;
}

export async function createTemplate(
  orgId: string,
  partial: Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<DocumentTemplate | null> {
  const { data, error } = await supabase
    .from('document_templates')
    .insert({ ...partial, organization_id: orgId })
    .select()
    .single();

  if (error) return null;
  invalidateCache(orgId, partial.type);
  return data as DocumentTemplate;
}

export async function duplicateTemplate(
  template: DocumentTemplate,
  newName: string
): Promise<DocumentTemplate | null> {
  const { id, created_at, updated_at, is_default, ...rest } = template;
  return createTemplate(template.organization_id, { ...rest, name: newName, is_default: false });
}

export async function setDefaultTemplate(
  templateId: string,
  orgId: string,
  type: 'invoice' | 'estimate'
): Promise<boolean> {
  await supabase
    .from('document_templates')
    .update({ is_default: false })
    .eq('organization_id', orgId)
    .eq('type', type);

  const { error } = await supabase
    .from('document_templates')
    .update({ is_default: true })
    .eq('id', templateId);

  invalidateCache(orgId, type);
  return !error;
}

export async function deleteTemplate(
  templateId: string,
  orgId: string,
  type: 'invoice' | 'estimate'
): Promise<boolean> {
  const { error } = await supabase
    .from('document_templates')
    .delete()
    .eq('id', templateId);

  invalidateCache(orgId, type);
  return !error;
}
