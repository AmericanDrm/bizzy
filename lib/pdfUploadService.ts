import { supabase } from '@/lib/supabase';

export type PdfDocumentType = 'invoice' | 'estimate';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const APP_BASE_URL = process.env.EXPO_PUBLIC_APP_URL || `${SUPABASE_URL}/functions/v1/pdf-redirect`;

function buildShortCode(documentType: PdfDocumentType, documentLabel: string): string {
  const prefix = documentType === 'invoice' ? 'i' : 'e';
  const slug = documentLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (!slug) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return `${prefix}-${slug}`;
}

async function resolveUniqueCode(baseCode: string, documentId: string): Promise<string> {
  const { data: existing, error } = await supabase
    .from('short_links')
    .select('code, document_id')
    .eq('code', baseCode)
    .maybeSingle();

  if (error) throw error;
  if (!existing) return baseCode;
  if (existing.document_id === documentId) return baseCode;

  const suffix = Math.random().toString(36).slice(2, 6);
  return `${baseCode}-${suffix}`;
}

async function upsertShortLink(
  code: string,
  targetUrl: string,
  organizationId: string,
  documentType: PdfDocumentType,
  documentId: string
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  const { data: existing, error: findError } = await supabase
    .from('short_links')
    .select('id, code')
    .eq('document_id', documentId)
    .eq('document_type', documentType)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error: updateError } = await supabase
      .from('short_links')
      .update({
        code,
        target_url: targetUrl,
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    return code;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('short_links')
    .insert({
      code,
      target_url: targetUrl,
      organization_id: organizationId,
      document_type: documentType,
      document_id: documentId,
      expires_at: expiresAt.toISOString(),
    })
    .select('code')
    .maybeSingle();

  if (insertError) throw insertError;
  if (!inserted) throw new Error('Short link insert returned no row');

  return inserted.code;
}

async function getExistingPdfUrl(
  documentType: PdfDocumentType,
  documentId: string
): Promise<string | null> {
  try {
    const table = documentType === 'invoice' ? 'invoices' : 'estimates';
    const { data } = await supabase
      .from(table)
      .select('pdf_url')
      .eq('id', documentId)
      .maybeSingle();
    return data?.pdf_url || null;
  } catch {
    return null;
  }
}

export async function getOrCreateShortLink(
  documentType: PdfDocumentType,
  documentId: string,
  organizationId: string,
  documentLabel?: string
): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from('short_links')
      .select('code')
      .eq('document_id', documentId)
      .eq('document_type', documentType)
      .maybeSingle();

    if (existing?.code) {
      return `${APP_BASE_URL}/${existing.code}`;
    }

    const targetUrl = await getExistingPdfUrl(documentType, documentId);
    if (!targetUrl || !documentLabel) return targetUrl;

    const baseCode = buildShortCode(documentType, documentLabel);
    const uniqueCode = await resolveUniqueCode(baseCode, documentId);
    const finalCode = await upsertShortLink(uniqueCode, targetUrl, organizationId, documentType, documentId);
    return `${APP_BASE_URL}/${finalCode}`;
  } catch {
    return null;
  }
}

export async function uploadPdfAndGetUrl(
  pdfBase64: string,
  documentType: PdfDocumentType,
  documentId: string,
  organizationId: string,
  documentLabel?: string
): Promise<string | null> {
  let longUrl: string | null = null;

  try {
    const binaryStr = atob(pdfBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const filePath = `${organizationId}/${documentType}s/${documentId}.pdf`;

    const { error } = await supabase.storage
      .from('invoice-pdfs')
      .upload(filePath, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error('PDF upload error:', error);
    } else {
      const { data: urlData } = supabase.storage
        .from('invoice-pdfs')
        .getPublicUrl(filePath);
      longUrl = urlData?.publicUrl || null;
    }
  } catch (err) {
    console.error('PDF upload failed:', err);
  }

  if (!longUrl) {
    const existing = await getExistingPdfUrl(documentType, documentId);
    if (existing) return existing;
    return null;
  }

  if (!documentLabel) return longUrl;

  try {
    const baseCode = buildShortCode(documentType, documentLabel);
    const uniqueCode = await resolveUniqueCode(baseCode, documentId);
    const finalCode = await upsertShortLink(uniqueCode, longUrl, organizationId, documentType, documentId);
    return `${APP_BASE_URL}/${finalCode}`;
  } catch (linkErr) {
    console.error('Short link creation failed, falling back to long URL:', linkErr);
    return longUrl;
  }
}
