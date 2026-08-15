export type BlockType =
  | 'header'
  | 'parties'
  | 'meta_bar'
  | 'line_items'
  | 'totals'
  | 'notes'
  | 'payment_info'
  | 'validity_notice'
  | 'divider'
  | 'spacer'
  | 'custom_text';

export interface TemplateBlock {
  id: string;
  type: BlockType;
  label: string;
  required: boolean;
  visible: boolean;
  order: number;
  content?: string;
}

export interface DocumentTemplate {
  id: string;
  organization_id: string;
  name: string;
  type: 'invoice' | 'estimate';
  is_default: boolean;
  accent_color: string;
  accent_light_color: string;
  blocks: TemplateBlock[];
  created_at: string;
  updated_at: string;
}

export const INVOICE_DEFAULT_BLOCKS: TemplateBlock[] = [
  { id: 'header', type: 'header', label: 'Header (Logo / Business Name)', required: true, visible: true, order: 0 },
  { id: 'parties', type: 'parties', label: 'From / Bill To', required: true, visible: true, order: 1 },
  { id: 'meta_bar', type: 'meta_bar', label: 'Date & Terms Bar', required: false, visible: true, order: 2 },
  { id: 'line_items', type: 'line_items', label: 'Line Items Table', required: true, visible: true, order: 3 },
  { id: 'totals', type: 'totals', label: 'Totals & Grand Total', required: true, visible: true, order: 4 },
  { id: 'notes', type: 'notes', label: 'Notes / Terms', required: false, visible: true, order: 5 },
  { id: 'payment_info', type: 'payment_info', label: 'Payment Information', required: false, visible: true, order: 6 },
];

export const ESTIMATE_DEFAULT_BLOCKS: TemplateBlock[] = [
  { id: 'header', type: 'header', label: 'Header (Logo / Business Name)', required: true, visible: true, order: 0 },
  { id: 'parties', type: 'parties', label: 'From / Prepared For', required: true, visible: true, order: 1 },
  { id: 'meta_bar', type: 'meta_bar', label: 'Date & Valid Until Bar', required: false, visible: true, order: 2 },
  { id: 'line_items', type: 'line_items', label: 'Line Items Table', required: true, visible: true, order: 3 },
  { id: 'totals', type: 'totals', label: 'Totals & Grand Total', required: true, visible: true, order: 4 },
  { id: 'notes', type: 'notes', label: 'Notes / Terms', required: false, visible: true, order: 5 },
  { id: 'validity_notice', type: 'validity_notice', label: 'Validity Notice', required: false, visible: true, order: 6 },
];

export const ACCENT_COLOR_PRESETS: { color: string; name: string }[] = [
  { color: '#1a3c5e', name: 'Navy' },
  { color: '#0f4c81', name: 'Royal Blue' },
  { color: '#1e6091', name: 'Ocean' },
  { color: '#155e75', name: 'Teal' },
  { color: '#065f46', name: 'Forest' },
  { color: '#14532d', name: 'Dark Green' },
  { color: '#1c1917', name: 'Charcoal' },
  { color: '#374151', name: 'Slate' },
  { color: '#7c2d12', name: 'Brick' },
  { color: '#831843', name: 'Maroon' },
  { color: '#9a3412', name: 'Rust' },
  { color: '#92400e', name: 'Amber Dark' },
  { color: '#1d4ed8', name: 'Blue' },
  { color: '#0369a1', name: 'Sky' },
  { color: '#0f766e', name: 'Emerald' },
  { color: '#b91c1c', name: 'Red' },
];

export function accentLightFromAccent(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * 0.88);
  const lg = Math.round(g + (255 - g) * 0.88);
  const lb = Math.round(b + (255 - b) * 0.88);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

export function buildDefaultTemplate(
  organizationId: string,
  type: 'invoice' | 'estimate'
): Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'> {
  return {
    organization_id: organizationId,
    name: type === 'invoice' ? 'Default Invoice' : 'Default Estimate',
    type,
    is_default: true,
    accent_color: '#1a3c5e',
    accent_light_color: '#e8eef4',
    blocks: type === 'invoice' ? [...INVOICE_DEFAULT_BLOCKS] : [...ESTIMATE_DEFAULT_BLOCKS],
  };
}
