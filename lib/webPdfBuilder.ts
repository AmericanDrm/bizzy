import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InvoicePDFData, EstimatePDFData } from './pdfGenerator';
import { formatCurrency } from './utilities';

type RGB = readonly [number, number, number];

const ACCENT: RGB = [26, 60, 94];
const ACCENT_LIGHT: RGB = [232, 238, 244];
const TEXT_PRIMARY: RGB = [30, 41, 59];
const TEXT_SECONDARY: RGB = [100, 116, 139];
const BORDER: RGB = [226, 232, 240];
const EVEN_ROW: RGB = [248, 250, 252];
const GREEN: RGB = [22, 163, 74];
const AMBER: RGB = [146, 64, 14];
const FEE_AMBER: RGB = [180, 83, 9];
const FOOTER_CLR: RGB = [148, 163, 184];
const VALIDITY_BG: RGB = [255, 251, 235];
const VALIDITY_BORDER: RGB = [253, 230, 138];

const PW = 210;
const PH = 297;
const ML = 20;
const MR = 20;
const CW = PW - ML - MR;

const paymentTermsLabel = (terms: string | undefined): string => {
  switch (terms) {
    case 'due_on_receipt': return 'Due on Receipt';
    case 'net_15': return 'Net 15';
    case 'net_30': return 'Net 30';
    case 'net_60': return 'Net 60';
    case 'net_90': return 'Net 90';
    default: return 'Net 30';
  }
};

const tc = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
const fc = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const dc = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

const contactLines = (doc: jsPDF, x: number, y: number, addr: string, phone: string, email: string): number => {
  doc.setFontSize(9);
  tc(doc, TEXT_SECONDARY);
  doc.setFont('helvetica', 'normal');
  const lines: string[] = [];
  if (addr) lines.push(addr);
  if (phone) lines.push(phone);
  if (email) lines.push(email);
  lines.forEach(l => {
    doc.text(l, x, y);
    y += 4.5;
  });
  return y;
};

const loadImageAsDataUrl = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
};

const header = (doc: jsPDF, bizName: string, docType: string, docNum: string, memo?: string, logoDataUrl?: string | null): number => {
  let y = 18;
  const cx = PW / 2;

  if (logoDataUrl) {
    const maxLogoW = 60;
    const maxLogoH = 20;
    try {
      const imgProps = doc.getImageProperties(logoDataUrl);
      const ratio = Math.min(maxLogoW / imgProps.width, maxLogoH / imgProps.height);
      const lw = imgProps.width * ratio;
      const lh = imgProps.height * ratio;
      doc.addImage(logoDataUrl, 'PNG', cx - lw / 2, y, lw, lh);
      y += lh + 4;
    } catch {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      tc(doc, ACCENT);
      doc.text(bizName || '', cx, y, { align: 'center' });
      y += 10;
    }
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    tc(doc, ACCENT);
    doc.text(bizName || '', cx, y, { align: 'center' });
    y += 10;
  }

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  tc(doc, ACCENT);
  doc.text(docType, cx, y, { align: 'center' });

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  tc(doc, TEXT_SECONDARY);
  doc.text(memo || `#${docNum}`, cx, y, { align: 'center' });

  y += 6;
  dc(doc, ACCENT);
  doc.setLineWidth(0.8);
  doc.line(ML, y, PW - MR, y);

  return y + 8;
};

const parties = (
  doc: jsPDF,
  y: number,
  rightLabel: string,
  bName: string, bAddr: string, bPhone: string, bEmail: string,
  cName: string, cAddr: string, cPhone: string, cEmail: string,
): number => {
  const colW = CW / 2 - 4;
  const rX = ML + CW / 2 + 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  tc(doc, ACCENT);
  doc.text('FROM', ML, y);
  doc.text(rightLabel.toUpperCase(), rX, y);

  y += 2;
  dc(doc, BORDER);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + colW, y);
  doc.line(rX, y, rX + colW, y);

  y += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  tc(doc, TEXT_PRIMARY);
  doc.text(bName || '', ML, y);
  doc.text(cName || '', rX, y);

  y += 5;
  const lY = contactLines(doc, ML, y, bAddr, bPhone, bEmail);
  const rY = contactLines(doc, rX, y, cAddr, cPhone, cEmail);

  return Math.max(lY, rY) + 4;
};

const metaBar = (doc: jsPDF, y: number, items: { label: string; value: string }[]): number => {
  const h = 14;
  fc(doc, ACCENT_LIGHT);
  doc.roundedRect(ML, y, CW, h, 2, 2, 'F');

  const iw = CW / items.length;
  items.forEach((item, i) => {
    const x = ML + 6 + i * iw;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    tc(doc, TEXT_SECONDARY);
    doc.text(item.label.toUpperCase(), x, y + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    tc(doc, TEXT_PRIMARY);
    doc.text(item.value, x, y + 10);
  });

  return y + h + 8;
};

const totalsRow = (doc: jsPDF, y: number, label: string, value: string, color?: RGB): number => {
  const lx = PW - MR - 65;
  const vx = PW - MR;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  tc(doc, color || TEXT_SECONDARY);
  doc.text(label, lx, y);

  doc.setFont('helvetica', 'bold');
  tc(doc, color || TEXT_PRIMARY);
  doc.text(value, vx, y, { align: 'right' });

  return y + 6;
};

const grandTotal = (doc: jsPDF, y: number, label: string, value: string): number => {
  const barH = 14;
  fc(doc, ACCENT);
  doc.roundedRect(ML, y, CW, barH, 2, 2, 'F');

  const WHITE: RGB = [255, 255, 255];
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  tc(doc, WHITE);
  doc.text(label, ML + 8, y + 9.5);
  doc.text(value, PW - MR - 8, y + 9.5, { align: 'right' });

  return y + barH + 8;
};

const notesBox = (doc: jsPDF, y: number, notes: string): number => {
  if (!notes) return y;

  doc.setFontSize(8.5);
  const noteLines = doc.splitTextToSize(notes, CW - 14);
  const bh = 12 + noteLines.length * 4;

  fc(doc, EVEN_ROW);
  doc.rect(ML, y, CW, bh, 'F');

  fc(doc, ACCENT);
  doc.rect(ML, y, 1.2, bh, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  tc(doc, ACCENT);
  doc.text('NOTES / TERMS', ML + 6, y + 5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  tc(doc, TEXT_SECONDARY);
  doc.text(noteLines, ML + 6, y + 10);

  return y + bh + 6;
};

const paymentOptionsBox = (doc: jsPDF, y: number, data: InvoicePDFData): number => {
  const methods: { label: string; amount: string; details: string[] }[] = [];
  const ccFeeAmount = data.cc_fee_amount ?? 0;
  const totalWithFee = data.total;
  const totalWithoutFee = ccFeeAmount > 0 ? totalWithFee - ccFeeAmount : totalWithFee;

  if (data.stripe_payment_link) {
    const cardLabel = ccFeeAmount > 0 ? 'Pay by Card (includes processing fee)' : 'Pay by Card';
    methods.push({ label: cardLabel, amount: formatCurrency(totalWithFee), details: [data.stripe_payment_link] });
  }
  if (data.venmo_username) {
    const handle = data.venmo_username.replace(/^@/, '');
    methods.push({ label: 'Pay with Venmo', amount: formatCurrency(totalWithoutFee), details: [`Send to @${handle}`] });
  }
  if (data.cashapp_username) {
    const tag = data.cashapp_username.replace(/^\$/, '');
    methods.push({ label: 'Pay with Cash App', amount: formatCurrency(totalWithoutFee), details: [`Send to $${tag}`] });
  }
  if (data.zelle_email || data.zelle_phone) {
    const target = data.zelle_email || data.zelle_phone!;
    const targetType = data.zelle_email ? 'email' : 'phone';
    methods.push({ label: 'Pay with Zelle', amount: formatCurrency(totalWithoutFee), details: [`Send to ${targetType}: ${target}`, `Memo: Invoice #${data.invoice_number}`] });
  }
  if (data.check_payable_to) {
    const checkDetails = [`Make payable to: ${data.check_payable_to}`];
    if (data.check_mailing_address) checkDetails.push(`Mail to: ${data.check_mailing_address}`);
    checkDetails.push(`Memo: Invoice #${data.invoice_number}`);
    methods.push({ label: 'Pay by Check', amount: formatCurrency(totalWithoutFee), details: checkDetails });
  }

  if (methods.length === 0) return y;

  if (y > PH - 60) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  tc(doc, ACCENT);
  doc.text('PAYMENT OPTIONS', ML + 6, y + 5);
  y += 8;

  dc(doc, ACCENT);
  doc.setLineWidth(0.6);
  doc.line(ML, y, ML + 40, y);
  y += 4;

  for (const method of methods) {
    if (y > PH - 30) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    tc(doc, TEXT_PRIMARY);
    doc.text(method.label, ML + 6, y);

    doc.setFont('helvetica', 'bold');
    tc(doc, ACCENT);
    doc.text(method.amount, PW - MR, y, { align: 'right' });
    y += 4.5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    tc(doc, TEXT_SECONDARY);
    for (const line of method.details) {
      const wrapped = doc.splitTextToSize(line, CW - 14);
      doc.text(wrapped, ML + 6, y);
      y += wrapped.length * 3.5;
    }
    y += 3;
  }

  return y + 4;
};

const ccFeeNoticeBox = (doc: jsPDF, y: number, ccFeePercent: number, feeAlreadyIncluded: boolean): number => {
  if (y > PH - 30) {
    doc.addPage();
    y = 20;
  }

  const boxH = feeAlreadyIncluded ? 14 : 20;
  const borderColor: [number, number, number] = feeAlreadyIncluded ? [14, 165, 233] : [245, 158, 11];
  const bgColor: [number, number, number] = feeAlreadyIncluded ? [240, 249, 255] : [255, 251, 235];
  const textColor: [number, number, number] = feeAlreadyIncluded ? [3, 105, 161] : [120, 53, 15];
  const labelColor: [number, number, number] = feeAlreadyIncluded ? [2, 132, 199] : [146, 64, 14];

  doc.setFillColor(...bgColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.6);
  doc.roundedRect(ML, y, CW, boxH, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...labelColor);
  const label = feeAlreadyIncluded ? 'CARD PROCESSING FEE INCLUDED' : 'CREDIT CARD FEE NOTICE';
  doc.text(label, ML + 5, y + 5.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  const msg = feeAlreadyIncluded
    ? `A ${ccFeePercent}% card processing fee is already included in the total above.`
    : `If paying by credit or debit card, a ${ccFeePercent}% processing fee will be added at checkout. To avoid this fee, pay by check, cash, Venmo, or Zelle.`;
  const msgLines = doc.splitTextToSize(msg, CW - 10);
  doc.text(msgLines, ML + 5, y + 10.5);

  return y + boxH + 6;
};

const footer = (doc: jsPDF, bizName: string, bizPhone: string, bizEmail: string) => {
  const y = PH - 15;
  dc(doc, BORDER);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);

  const parts: string[] = [];
  if (bizName) parts.push(bizName);
  if (bizPhone) parts.push(bizPhone);
  if (bizEmail) parts.push(bizEmail);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  tc(doc, FOOTER_CLR);
  doc.text(parts.join('  |  '), PW / 2, y + 5, { align: 'center' });
};

const tableConfig = (startY: number) => ({
  startY,
  margin: { left: ML, right: MR },
  headStyles: {
    fillColor: [ACCENT[0], ACCENT[1], ACCENT[2]] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontSize: 7.5,
    fontStyle: 'bold' as const,
    cellPadding: 3.5,
  },
  bodyStyles: {
    fontSize: 9,
    textColor: [TEXT_PRIMARY[0], TEXT_PRIMARY[1], TEXT_PRIMARY[2]] as [number, number, number],
    cellPadding: 3.5,
    lineColor: [BORDER[0], BORDER[1], BORDER[2]] as [number, number, number],
    lineWidth: 0.3,
  },
  alternateRowStyles: {
    fillColor: [EVEN_ROW[0], EVEN_ROW[1], EVEN_ROW[2]] as [number, number, number],
  },
  columnStyles: {
    0: { cellWidth: 'auto' as const },
    1: { cellWidth: 20, halign: 'center' as const },
    2: { cellWidth: 28, halign: 'right' as const },
    3: { cellWidth: 30, halign: 'right' as const, fontStyle: 'bold' as const },
  },
  theme: 'plain' as const,
});

export const buildInvoicePDF = async (data: InvoicePDFData): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const logoDataUrl = data.logo_url ? await loadImageAsDataUrl(data.logo_url) : null;

  fc(doc, ACCENT);
  doc.rect(0, 0, 12, PH, 'F');

  let y = header(doc, data.business_name, 'INVOICE', data.invoice_number, data.memo, logoDataUrl);

  y = parties(
    doc, y, 'Bill To',
    data.business_name, data.business_address, data.business_phone, data.business_email,
    data.client_name, data.client_address, data.client_phone, data.client_email,
  );

  y = metaBar(doc, y, [
    { label: 'Issue Date', value: data.issue_date },
    { label: 'Due Date', value: data.due_date },
    { label: 'Payment Terms', value: paymentTermsLabel(data.payment_terms) },
  ]);

  const rows = data.items.map(item => [
    item.description,
    String(item.quantity),
    formatCurrency(item.unit_price),
    formatCurrency(item.total),
  ]);

  autoTable(doc, {
    ...tableConfig(y),
    head: [['Description', 'Qty', 'Rate', 'Amount']],
    body: rows,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  y = totalsRow(doc, y, 'Subtotal', formatCurrency(data.subtotal));
  if (data.tax_rate > 0) {
    y = totalsRow(doc, y, `Tax (${data.tax_rate}%)`, formatCurrency(data.tax_amount));
  }
  if (data.late_fee_amount && data.late_fee_amount > 0) {
    y = totalsRow(doc, y, 'Late Fee', formatCurrency(data.late_fee_amount), FEE_AMBER);
  }
  if (data.cc_fee_amount && data.cc_fee_amount > 0) {
    y = totalsRow(doc, y, `CC Processing Fee (${data.cc_fee_percent ?? 0}%)`, formatCurrency(data.cc_fee_amount));
  }
  y = grandTotal(doc, y, 'Total Due', formatCurrency(data.total));

  y = notesBox(doc, y, data.notes);

  if (data.show_cc_fee_notice && (data.cc_fee_percent ?? 0) > 0) {
    const feeAlreadyIncluded = (data.cc_fee_amount ?? 0) > 0;
    y = ccFeeNoticeBox(doc, y, data.cc_fee_percent!, feeAlreadyIncluded);
  }

  y = paymentOptionsBox(doc, y, data);

  footer(doc, data.business_name, data.business_phone, data.business_email);

  return doc;
};

export const buildEstimatePDF = async (data: EstimatePDFData): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const logoDataUrl = data.logo_url ? await loadImageAsDataUrl(data.logo_url) : null;

  fc(doc, ACCENT);
  doc.rect(0, 0, 12, PH, 'F');

  let y = header(doc, data.business_name, 'ESTIMATE', data.estimate_number, data.memo, logoDataUrl);

  y = parties(
    doc, y, 'Prepared For',
    data.business_name, data.business_address, data.business_phone, data.business_email,
    data.client_name, data.client_address, data.client_phone, data.client_email,
  );

  y = metaBar(doc, y, [
    { label: 'Issue Date', value: data.issue_date },
    { label: 'Valid Until', value: data.valid_until },
  ]);

  const rows = data.items.map(item => {
    let desc = item.description;
    if (item.is_optional) desc += '  [OPTIONAL]';
    if (item.discount_amount && item.discount_amount > 0) {
      desc += `\nDiscount: -${formatCurrency(item.discount_amount)}`;
    } else if (item.discount_percentage && item.discount_percentage > 0) {
      desc += `\nDiscount: -${item.discount_percentage}%`;
    }
    return [desc, String(item.quantity), formatCurrency(item.unit_price), formatCurrency(item.total)];
  });

  autoTable(doc, {
    ...tableConfig(y),
    head: [['Service', 'Qty', 'Rate', 'Amount']],
    body: rows,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  const estScopeMap: Record<string, number> = {};
  for (const item of data.items) {
    const s = item.service_scope || 'full_service';
    estScopeMap[s] = (estScopeMap[s] || 0) + item.total;
  }
  const estScopes = Object.keys(estScopeMap);
  const estHasMultipleScopes = estScopes.length > 1;

  if (estHasMultipleScopes) {
    const discountRatio = data.subtotal > 0
      ? (data.subtotal / data.items.reduce((s, i) => s + i.total, 0))
      : 1;
    const taxRateNum = data.tax_rate / 100;
    const eScopeLabel = (s: string) => s === 'full_service' ? 'Full Service' : s === 'exterior_only' ? 'Exterior Only' : s === 'interior_only' ? 'Interior Only' : s;
    for (const scope of estScopes) {
      const scopeSubtotal = estScopeMap[scope] * discountRatio;
      const scopeTotal = scopeSubtotal * (1 + taxRateNum);
      y = grandTotal(doc, y, `${eScopeLabel(scope)} Total (incl. tax)`, formatCurrency(scopeTotal));
    }
  } else {
    y = totalsRow(doc, y, 'Subtotal', formatCurrency(data.subtotal));

    if (data.discount_amount && data.discount_amount > 0) {
      y = totalsRow(doc, y, 'Discount', `-${formatCurrency(data.discount_amount)}`, GREEN);
    } else if (data.discount_percentage && data.discount_percentage > 0) {
      const amt = data.subtotal * (data.discount_percentage / 100);
      y = totalsRow(doc, y, `Discount (${data.discount_percentage}%)`, `-${formatCurrency(amt)}`, GREEN);
    }

    if (data.tax_rate > 0) {
      y = totalsRow(doc, y, `Tax (${data.tax_rate}%)`, formatCurrency(data.tax_amount));
    }

    y = grandTotal(doc, y, 'Total', formatCurrency(data.total));
  }
  y = notesBox(doc, y, data.notes);

  const vh = 10;
  fc(doc, VALIDITY_BG);
  dc(doc, VALIDITY_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, vh, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  tc(doc, AMBER);
  doc.text(`This estimate is valid until ${data.valid_until}`, PW / 2, y + 6.5, { align: 'center' });

  footer(doc, data.business_name, data.business_phone, data.business_email);

  return doc;
};

export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(`${filename}.pdf`);
};
