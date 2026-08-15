import { supabase } from '@/lib/supabase';

interface WorkOrder {
  id: string;
  client_name: string;
  client_phone: string;
  job_type: string;
  scope: string;
  notes: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  location: string;
  address: string;
  crew_size: number;
  amount: number;
  visible_fields: string[];
  custom_fields: Record<string, string>;
  schedule_event_id: string | null;
}

interface SupplyItem {
  supply_name: string;
  quantity: number | null;
  unit: string | null;
}

const ALL_FIELD_KEYS = [
  'client_name', 'client_phone', 'job_type', 'scope', 'notes',
  'scheduled_date', 'scheduled_time', 'location', 'address', 'crew_size', 'amount',
];

const FIELD_LABELS: Record<string, string> = {
  client_name: 'CLIENT',
  client_phone: 'PHONE',
  job_type: 'JOB TYPE',
  scope: 'SCOPE OF WORK',
  notes: 'NOTES',
  scheduled_date: 'DATE',
  scheduled_time: 'TIME',
  location: 'LOCATION',
  address: 'ADDRESS',
  crew_size: 'CREW SIZE',
  amount: 'AMOUNT',
};

const ACCENT: [number, number, number] = [26, 60, 94];
const ACCENT_LIGHT: [number, number, number] = [232, 238, 244];
const TEXT_PRIMARY: [number, number, number] = [30, 41, 59];
const TEXT_SECONDARY: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [226, 232, 240];

function formatFieldValue(key: string, order: WorkOrder): string {
  const raw = (order as any)[key];
  if (!raw && raw !== 0) return '';
  switch (key) {
    case 'scheduled_date': {
      const d = new Date(raw + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    case 'crew_size':
      return `${raw} ${raw === 1 ? 'person' : 'people'}`;
    case 'amount':
      return `$${(raw || 0).toFixed(2)}`;
    default:
      return String(raw);
  }
}

function getVisibleFields(order: WorkOrder): string[] {
  return order.visible_fields && order.visible_fields.length > 0
    ? order.visible_fields
    : ALL_FIELD_KEYS;
}

async function fetchBusinessInfo(organizationId: string | null) {
  if (organizationId) {
    const { data } = await supabase
      .from('business_settings')
      .select('business_name, business_phone')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (data?.business_name) {
      return { name: data.business_name, phone: data.business_phone || '' };
    }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, business_name, business_phone')
    .maybeSingle();
  return {
    name: profile?.business_name || profile?.display_name || 'My Business',
    phone: profile?.business_phone || '',
  };
}

async function fetchSuppliesForOrders(orders: WorkOrder[]): Promise<Map<string, SupplyItem[]>> {
  const eventIds = orders.map(o => o.schedule_event_id).filter(Boolean) as string[];
  if (eventIds.length === 0) return new Map();

  const { data } = await supabase
    .from('job_supplies')
    .select('job_id, supply_name, quantity, unit')
    .in('job_id', eventIds)
    .order('supply_name');

  const map = new Map<string, SupplyItem[]>();
  (data || []).forEach((s: any) => {
    const list = map.get(s.job_id) || [];
    list.push({ supply_name: s.supply_name, quantity: s.quantity, unit: s.unit });
    map.set(s.job_id, list);
  });
  return map;
}

function drawBusinessHeader(doc: any, bizName: string, bizPhone: string, PW: number, ML: number, MR: number): number {
  const cx = PW / 2;
  let y = 18;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text(bizName, cx, y, { align: 'center' });

  if (bizPhone) {
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_SECONDARY[0], TEXT_SECONDARY[1], TEXT_SECONDARY[2]);
    doc.text(bizPhone, cx, y, { align: 'center' });
  }

  y += 4;
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(0.6);
  doc.line(ML, y, PW - MR, y);
  y += 4;
  return y;
}

function drawCheckbox(doc: any, x: number, y: number, size: number = 3.5) {
  doc.setDrawColor(TEXT_SECONDARY[0], TEXT_SECONDARY[1], TEXT_SECONDARY[2]);
  doc.setLineWidth(0.3);
  doc.rect(x, y - size + 0.5, size, size);
}

function drawEquipmentSection(
  doc: any, supplies: SupplyItem[], ML: number, CW: number, y: number, label: string
): number {
  if (supplies.length === 0) return y;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text(label, ML, y);
  y += 2;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.line(ML, y, ML + CW, y);
  y += 4;

  const colCount = 3;
  const colW = CW / colCount;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);

  supplies.forEach((item, idx) => {
    const col = idx % colCount;
    const row = Math.floor(idx / colCount);
    const itemX = ML + col * colW;
    const itemY = y + row * 5;

    drawCheckbox(doc, itemX, itemY, 3);
    const qty = item.quantity ? `(${item.quantity}${item.unit ? ' ' + item.unit : ''})` : '';
    doc.text(`${item.supply_name} ${qty}`.trim(), itemX + 4.5, itemY);
  });

  const totalRows = Math.ceil(supplies.length / colCount);
  y += totalRows * 5 + 3;
  return y;
}

export async function generateSingleWorkOrderPDF(order: WorkOrder, organizationId: string | null) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const PW = 210;
  const ML = 20;
  const MR = 20;
  const CW = PW - ML - MR;

  const biz = await fetchBusinessInfo(organizationId);
  const suppliesMap = await fetchSuppliesForOrders([order]);
  const supplies = order.schedule_event_id ? (suppliesMap.get(order.schedule_event_id) || []) : [];
  const visibleFields = getVisibleFields(order);

  let y = drawBusinessHeader(doc, biz.name, biz.phone, PW, ML, MR);

  const cx = PW / 2;
  y += 4;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text('WORK ORDER', cx, y, { align: 'center' });

  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_SECONDARY[0], TEXT_SECONDARY[1], TEXT_SECONDARY[2]);
  const dateStr = order.scheduled_date
    ? new Date(order.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.text(dateStr, cx, y, { align: 'center' });
  y += 8;

  y = drawEquipmentSection(doc, supplies, ML, CW, y, 'EQUIPMENT NEEDED');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
  doc.text(order.client_name || '', ML, y);

  const clientPhone = order.client_phone || '';
  if (clientPhone) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_SECONDARY[0], TEXT_SECONDARY[1], TEXT_SECONDARY[2]);
    doc.text(clientPhone, PW - MR, y, { align: 'right' });
  }

  y += 4;
  const clientAddr = order.address || order.location || '';
  if (clientAddr) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_SECONDARY[0], TEXT_SECONDARY[1], TEXT_SECONDARY[2]);
    doc.text(clientAddr, ML, y);
    y += 4;
  }

  y += 2;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + CW, y);
  y += 4;

  const metaFields = visibleFields.filter(f =>
    !['client_name', 'client_phone', 'address', 'location', 'scope', 'notes'].includes(f)
  );

  if (metaFields.length > 0) {
    doc.setFillColor(ACCENT_LIGHT[0], ACCENT_LIGHT[1], ACCENT_LIGHT[2]);
    doc.roundedRect(ML, y, CW, 14, 2, 2, 'F');
    const iw = CW / metaFields.length;
    metaFields.forEach((key, i) => {
      const x = ML + 6 + i * iw;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_SECONDARY[0], TEXT_SECONDARY[1], TEXT_SECONDARY[2]);
      doc.text(FIELD_LABELS[key] || key.toUpperCase(), x, y + 4.5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
      doc.text(formatFieldValue(key, order) || '\u2014', x, y + 10);
    });
    y += 20;
  }

  const longFields = ['scope', 'notes'].filter(f => visibleFields.includes(f));
  longFields.forEach((key) => {
    const val = (order as any)[key];
    if (!val) return;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(FIELD_LABELS[key], ML, y);
    y += 2;
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(ML, y, ML + CW, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
    const wrapped = doc.splitTextToSize(val, CW);
    doc.text(wrapped, ML, y);
    y += wrapped.length * 5 + 6;
  });

  const customEntries = Object.entries(order.custom_fields || {}).filter(([, v]) => v);
  customEntries.forEach(([k, v]) => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(k.toUpperCase(), ML, y);
    y += 2;
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.2);
    doc.line(ML, y, ML + CW, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
    const wrapped = doc.splitTextToSize(v, CW);
    doc.text(wrapped, ML, y);
    y += wrapped.length * 5 + 6;
  });

  const footerY = 287;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, cx, footerY, { align: 'center' });

  const clientSlug = (order.client_name || 'work-order').replace(/\s+/g, '-').toLowerCase();
  doc.save(`work-order-${clientSlug}.pdf`);
}

function renderCompactWorkOrder(
  doc: any,
  order: WorkOrder,
  supplies: SupplyItem[],
  ML: number,
  CW: number,
  PW: number,
  MR: number,
  startY: number,
): number {
  let y = startY;
  const visibleFields = getVisibleFields(order);

  drawCheckbox(doc, PW - MR - 4, y - 1, 4);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
  doc.text(order.client_name || 'No Client', ML, y);

  const clientPhone = order.client_phone || '';
  if (clientPhone && visibleFields.includes('client_phone')) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_SECONDARY[0], TEXT_SECONDARY[1], TEXT_SECONDARY[2]);
    const phoneX = PW - MR - 8;
    doc.text(clientPhone, phoneX, y, { align: 'right' });
  }
  y += 4;

  const clientAddr = order.address || order.location || '';
  if (clientAddr && (visibleFields.includes('address') || visibleFields.includes('location'))) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_SECONDARY[0], TEXT_SECONDARY[1], TEXT_SECONDARY[2]);
    doc.text(clientAddr, ML, y);
    y += 4;
  }

  const inlineKeys = visibleFields.filter(f =>
    !['client_name', 'client_phone', 'address', 'location', 'scope', 'notes'].includes(f)
  );

  if (inlineKeys.length > 0) {
    const parts = inlineKeys.map(k => {
      const label = FIELD_LABELS[k] || k.toUpperCase();
      const val = formatFieldValue(k, order) || '\u2014';
      return `${label}: ${val}`;
    });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);

    const lineText = parts.join('   |   ');
    const wrapped = doc.splitTextToSize(lineText, CW);
    doc.text(wrapped, ML, y);
    y += wrapped.length * 3.8 + 1;
  }

  const longFields = ['scope', 'notes'].filter(f => visibleFields.includes(f));
  longFields.forEach((key) => {
    const val = (order as any)[key];
    if (!val) return;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(FIELD_LABELS[key], ML, y);
    y += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
    const wrapped = doc.splitTextToSize(val, CW);
    const maxLines = Math.min(wrapped.length, 3);
    doc.text(wrapped.slice(0, maxLines), ML, y);
    y += maxLines * 3.5 + 1;
  });

  const customEntries = Object.entries(order.custom_fields || {}).filter(([, v]) => v);
  customEntries.forEach(([k, v]) => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(k.toUpperCase(), ML, y);
    y += 3;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);
    const wrapped = doc.splitTextToSize(v, CW);
    const maxLines = Math.min(wrapped.length, 2);
    doc.text(wrapped.slice(0, maxLines), ML, y);
    y += maxLines * 3.5 + 1;
  });

  if (supplies.length > 0) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('EQUIPMENT', ML, y);
    y += 3;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]);

    const colCount = 3;
    const colW = CW / colCount;
    supplies.forEach((item, idx) => {
      const col = idx % colCount;
      const row = Math.floor(idx / colCount);
      const itemX = ML + col * colW;
      const itemY = y + row * 4;
      drawCheckbox(doc, itemX, itemY, 2.5);
      const qty = item.quantity ? `(${item.quantity})` : '';
      doc.text(`${item.supply_name} ${qty}`.trim(), itemX + 3.5, itemY);
    });
    const totalRows = Math.ceil(supplies.length / colCount);
    y += totalRows * 4 + 1;
  }

  return y;
}

export async function generateBatchWorkOrderPDF(orders: WorkOrder[], organizationId: string | null) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const PW = 210;
  const ML = 15;
  const MR = 15;
  const CW = PW - ML - MR;
  const PAGE_BOTTOM = 280;

  const biz = await fetchBusinessInfo(organizationId);
  const suppliesMap = await fetchSuppliesForOrders(orders);

  const allSupplies: SupplyItem[] = [];
  const seenNames = new Set<string>();
  orders.forEach(o => {
    if (!o.schedule_event_id) return;
    const items = suppliesMap.get(o.schedule_event_id) || [];
    items.forEach(s => {
      const key = s.supply_name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        allSupplies.push(s);
      }
    });
  });

  let y = drawBusinessHeader(doc, biz.name, biz.phone, PW, ML, MR);

  if (allSupplies.length > 0) {
    y = drawEquipmentSection(doc, allSupplies, ML, CW, y, 'EQUIPMENT NEEDED TODAY');
    y += 2;
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(0.4);
    doc.line(ML, y, PW - MR, y);
    y += 6;
  }

  orders.forEach((order, idx) => {
    const supplies = order.schedule_event_id ? (suppliesMap.get(order.schedule_event_id) || []) : [];
    const estimatedHeight = 30 + (supplies.length > 0 ? Math.ceil(supplies.length / 3) * 4 + 8 : 0);

    if (y + estimatedHeight > PAGE_BOTTOM && idx > 0) {
      doc.addPage();
      y = drawBusinessHeader(doc, biz.name, biz.phone, PW, ML, MR);
      y += 2;
    }

    y = renderCompactWorkOrder(doc, order, supplies, ML, CW, PW, MR, y);

    if (idx < orders.length - 1) {
      y += 3;
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.setLineWidth(0.3);
      doc.line(ML, y, PW - MR, y);
      y += 5;
    }
  });

  const footerY = 290;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.text(`Generated ${new Date().toLocaleDateString()} | Page ${p} of ${totalPages}`, PW / 2, footerY, { align: 'center' });
  }

  doc.save('work-orders.pdf');
}
