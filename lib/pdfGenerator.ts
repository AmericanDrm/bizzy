import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { formatCurrency } from './utilities';
import type { TemplateBlock } from './documentTemplateTypes';

export interface TemplatePDFConfig {
  blocks: TemplateBlock[];
  accent_color: string;
  accent_light_color: string;
}

export interface InvoicePDFData {
  invoice_number: string;
  memo?: string;
  issue_date: string;
  due_date: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  logo_url?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    service_scope?: string;
  }>;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  payment_terms?: string;
  late_fee_amount?: number;
  cc_fee_percent?: number;
  cc_fee_amount?: number;
  show_cc_fee_notice?: boolean;
  venmo_username?: string;
  cashapp_username?: string;
  zelle_email?: string;
  zelle_phone?: string;
  check_payable_to?: string;
  check_mailing_address?: string;
  stripe_payment_link?: string;
}

export interface EstimatePDFData {
  estimate_number: string;
  memo?: string;
  issue_date: string;
  valid_until: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  logo_url?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    is_optional?: boolean;
    discount_amount?: number;
    discount_percentage?: number;
    service_scope?: string;
  }>;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount?: number;
  discount_percentage?: number;
  total: number;
  notes: string;
  validity_period?: string;
}

const ACCENT = '#1a3c5e';
const ACCENT_LIGHT = '#e8eef4';
const TEXT_PRIMARY = '#1e293b';
const TEXT_SECONDARY = '#64748b';
const BORDER = '#e2e8f0';

const getPaymentTermsLabel = (terms: string | undefined): string => {
  switch (terms) {
    case 'due_on_receipt': return 'Due on Receipt';
    case 'net_15': return 'Net 15';
    case 'net_30': return 'Net 30';
    case 'net_60': return 'Net 60';
    case 'net_90': return 'Net 90';
    default: return 'Net 30';
  }
};

const esc = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const contactBlock = (address: string, phone: string, email: string): string => {
  const lines: string[] = [];
  if (address) lines.push(esc(address));
  if (phone) lines.push(esc(phone));
  if (email) lines.push(esc(email));
  return lines.map(l => `<div class="contact-line">${l}</div>`).join('');
};

const pdfStyles = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: ${TEXT_PRIMARY};
    line-height: 1.45;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page-wrap {
    display: flex;
    min-height: 100vh;
    max-width: 820px;
    margin: 0 auto;
  }
  .stripe {
    width: 48px;
    background: ${ACCENT};
    flex-shrink: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    flex: 1;
    padding: 48px 44px 48px 24px;
    display: flex;
    flex-direction: column;
  }
  .grow { flex: 1; }

  .doc-header {
    text-align: center;
    padding-bottom: 28px;
    border-bottom: 3px solid ${ACCENT};
    margin-bottom: 36px;
  }
  .logo { max-width: 200px; max-height: 72px; display: block; margin: 0 auto 8px; }
  .biz-name-header { font-size: 18px; font-weight: 700; color: ${ACCENT}; margin-bottom: 8px; }
  .doc-type { margin-top: 4px; }
  .doc-type {
    font-size: 36px;
    font-weight: 800;
    color: ${ACCENT};
    letter-spacing: 4px;
    line-height: 1;
  }
  .doc-num { font-size: 14px; color: ${TEXT_SECONDARY}; margin-top: 6px; }

  .parties {
    display: flex;
    gap: 48px;
    margin-bottom: 28px;
  }
  .party { flex: 1; }
  .party-label {
    font-size: 9px;
    font-weight: 700;
    color: ${ACCENT};
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid ${BORDER};
  }
  .party-name {
    font-size: 15px;
    font-weight: 700;
    color: ${TEXT_PRIMARY};
    margin-bottom: 6px;
  }
  .contact-line {
    font-size: 12px;
    color: ${TEXT_SECONDARY};
    line-height: 1.7;
  }

  .meta-bar {
    display: flex;
    background: ${ACCENT_LIGHT};
    border-radius: 6px;
    padding: 14px 20px;
    margin-bottom: 32px;
    gap: 36px;
  }
  .meta-item {}
  .meta-label {
    font-size: 9px;
    font-weight: 700;
    color: ${TEXT_SECONDARY};
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .meta-value {
    font-size: 13px;
    font-weight: 700;
    color: ${TEXT_PRIMARY};
    margin-top: 3px;
  }

  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead th {
    background: ${ACCENT};
    color: #ffffff;
    padding: 11px 14px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    text-align: left;
  }
  thead th.r { text-align: right; }
  thead th:first-child { border-radius: 4px 0 0 0; }
  thead th:last-child { border-radius: 0 4px 0 0; }
  tbody td {
    padding: 13px 14px;
    font-size: 13px;
    color: ${TEXT_PRIMARY};
    border-bottom: 1px solid ${BORDER};
    vertical-align: top;
  }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .td-r { text-align: right; }
  .td-c { text-align: center; }
  .opt-badge {
    display: inline-block;
    background: #fef3c7;
    color: #92400e;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 3px;
    margin-left: 6px;
    vertical-align: middle;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .item-discount {
    font-size: 11px;
    color: #16a34a;
    margin-top: 3px;
  }

  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .totals { width: 280px; }
  .t-row {
    display: flex;
    justify-content: space-between;
    padding: 7px 0;
    font-size: 13px;
  }
  .t-label { color: ${TEXT_SECONDARY}; }
  .t-value { font-weight: 600; color: ${TEXT_PRIMARY}; }
  .t-row.discount .t-label,
  .t-row.discount .t-value { color: #16a34a; }
  .t-row.fee .t-label,
  .t-row.fee .t-value { color: #b45309; }
  .grand-total-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: ${ACCENT};
    color: #ffffff;
    padding: 14px 24px;
    border-radius: 6px;
    margin-bottom: 28px;
    font-size: 20px;
    font-weight: 800;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .notes-box {
    background: #f8fafc;
    border-left: 4px solid ${ACCENT};
    padding: 16px 20px;
    border-radius: 0 6px 6px 0;
    margin-bottom: 32px;
  }
  .notes-label {
    font-size: 10px;
    font-weight: 700;
    color: ${ACCENT};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .notes-text {
    font-size: 12px;
    color: ${TEXT_SECONDARY};
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .validity {
    text-align: center;
    padding: 12px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    font-size: 12px;
    color: #92400e;
    font-weight: 600;
    margin-bottom: 32px;
  }

  .doc-footer {
    border-top: 1px solid ${BORDER};
    padding-top: 16px;
    text-align: center;
    font-size: 10px;
    color: #94a3b8;
    line-height: 1.8;
  }
  .doc-footer strong { color: ${TEXT_SECONDARY}; }

  @media print {
    body { background: #fff; }
    .page { padding: 40px 44px 40px 20px; min-height: auto; }
  }
`;

const generateInvoiceHTML = (data: InvoicePDFData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td>${esc(item.description)}</td>
        <td class="td-c">${item.quantity}</td>
        <td class="td-r">${formatCurrency(item.unit_price)}</td>
        <td class="td-r" style="font-weight:600">${formatCurrency(item.total)}</td>
      </tr>`
    )
    .join('');

  const taxRow =
    data.tax_rate > 0
      ? `<div class="t-row"><span class="t-label">Tax (${data.tax_rate}%)</span><span class="t-value">${formatCurrency(data.tax_amount)}</span></div>`
      : '';

  const feeRow =
    data.late_fee_amount && data.late_fee_amount > 0
      ? `<div class="t-row fee"><span class="t-label">Late Fee</span><span class="t-value">${formatCurrency(data.late_fee_amount)}</span></div>`
      : '';

  const ccFeeRow =
    data.cc_fee_amount && data.cc_fee_amount > 0
      ? `<div class="t-row"><span class="t-label">CC Processing Fee (${data.cc_fee_percent ?? 0}%)</span><span class="t-value">${formatCurrency(data.cc_fee_amount)}</span></div>`
      : '';

  const footerParts: string[] = [];
  if (data.business_name) footerParts.push(`<strong>${esc(data.business_name)}</strong>`);
  if (data.business_phone) footerParts.push(esc(data.business_phone));
  if (data.business_email) footerParts.push(esc(data.business_email));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invoice ${esc(data.invoice_number)}</title>
  <style>${pdfStyles}</style>
</head>
<body>
<div class="page-wrap">
  <div class="stripe"></div>
  <div class="page">
    <div class="doc-header">
      ${data.logo_url ? `<img src="${esc(data.logo_url)}" class="logo" alt="Logo" crossorigin="anonymous" />` : `<div class="biz-name-header">${esc(data.business_name)}</div>`}
      <div class="doc-type">INVOICE</div>
      <div class="doc-num">${data.memo ? esc(data.memo) : '#' + esc(data.invoice_number)}</div>
    </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${esc(data.business_name)}</div>
      ${contactBlock(data.business_address, data.business_phone, data.business_email)}
    </div>
    <div class="party">
      <div class="party-label">Bill To</div>
      <div class="party-name">${esc(data.client_name)}</div>
      ${contactBlock(data.client_address, data.client_phone, data.client_email)}
    </div>
  </div>

  <div class="meta-bar">
    <div class="meta-item">
      <div class="meta-label">Issue Date</div>
      <div class="meta-value">${esc(data.issue_date)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Due Date</div>
      <div class="meta-value">${esc(data.due_date)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Payment Terms</div>
      <div class="meta-value">${getPaymentTermsLabel(data.payment_terms)}</div>
    </div>
  </div>

  <div class="grow">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="r" style="width:70px">Qty</th>
          <th class="r" style="width:100px">Rate</th>
          <th class="r" style="width:110px">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals">
        <div class="t-row">
          <span class="t-label">Subtotal</span>
          <span class="t-value">${formatCurrency(data.subtotal)}</span>
        </div>
        ${taxRow}
        ${feeRow}
        ${ccFeeRow}
      </div>
    </div>
    <div class="grand-total-bar">
      <span>Total Due</span>
      <span>${formatCurrency(data.total)}</span>
    </div>

    ${data.notes ? `<div class="notes-box"><div class="notes-label">Notes / Terms</div><div class="notes-text">${esc(data.notes)}</div></div>` : ''}

    ${(() => {
      const ccFeeAmount = data.cc_fee_amount ?? 0;
      const totalWithoutFee = ccFeeAmount > 0 ? data.total - ccFeeAmount : data.total;
      const methods: string[] = [];
      if (data.stripe_payment_link) {
        const cardLabel = ccFeeAmount > 0 ? 'Pay by Card (includes processing fee)' : 'Pay by Card';
        methods.push(`<div class="payment-method-item"><strong>${cardLabel}:</strong> <a href="${esc(data.stripe_payment_link)}">${esc(data.stripe_payment_link)}</a></div>`);
      }
      if (data.venmo_username) {
        const handle = data.venmo_username.replace(/^@/, '');
        methods.push(`<div class="payment-method-item"><strong>Venmo:</strong> @${esc(handle)} &mdash; ${formatCurrency(totalWithoutFee)}</div>`);
      }
      if (data.cashapp_username) {
        const tag = data.cashapp_username.replace(/^\$/, '');
        methods.push(`<div class="payment-method-item"><strong>Cash App:</strong> $${esc(tag)} &mdash; ${formatCurrency(totalWithoutFee)}</div>`);
      }
      if (data.zelle_email || data.zelle_phone) {
        const target = data.zelle_email || data.zelle_phone!;
        const type = data.zelle_email ? 'email' : 'phone';
        methods.push(`<div class="payment-method-item"><strong>Zelle (${type}):</strong> ${esc(target)} &mdash; ${formatCurrency(totalWithoutFee)}<br/>Memo: Invoice #${esc(data.invoice_number)}</div>`);
      }
      if (data.check_payable_to) {
        let checkHtml = `<div class="payment-method-item"><strong>Check payable to:</strong> ${esc(data.check_payable_to)}`;
        if (data.check_mailing_address) checkHtml += `<br/>Mail to: ${esc(data.check_mailing_address)}`;
        checkHtml += `<br/>Memo: Invoice #${esc(data.invoice_number)}</div>`;
        methods.push(checkHtml);
      }
      return methods.length > 0 ? `<div class="notes-box"><div class="notes-label">How to Pay</div>${methods.join('')}</div>` : '';
    })()}
  </div>

  <div class="doc-footer">
    ${footerParts.join(' &nbsp;&middot;&nbsp; ')}
  </div>
</div>
</div>
</body>
</html>`;
};

const generateEstimateHTML = (data: EstimatePDFData): string => {
  const rows = data.items
    .map((item) => {
      const optBadge = item.is_optional ? '<span class="opt-badge">Optional</span>' : '';
      let discLine = '';
      if (item.discount_amount && item.discount_amount > 0) {
        discLine = `<div class="item-discount">Discount: -${formatCurrency(item.discount_amount)}</div>`;
      } else if (item.discount_percentage && item.discount_percentage > 0) {
        discLine = `<div class="item-discount">Discount: -${item.discount_percentage}%</div>`;
      }
      return `<tr>
        <td>${esc(item.description)}${optBadge}${discLine}</td>
        <td class="td-c">${item.quantity}</td>
        <td class="td-r">${formatCurrency(item.unit_price)}</td>
        <td class="td-r" style="font-weight:600">${formatCurrency(item.total)}</td>
      </tr>`;
    })
    .join('');

  let discountRow = '';
  if (data.discount_amount && data.discount_amount > 0) {
    discountRow = `<div class="t-row discount"><span class="t-label">Discount</span><span class="t-value">-${formatCurrency(data.discount_amount)}</span></div>`;
  } else if (data.discount_percentage && data.discount_percentage > 0) {
    const amt = data.subtotal * (data.discount_percentage / 100);
    discountRow = `<div class="t-row discount"><span class="t-label">Discount (${data.discount_percentage}%)</span><span class="t-value">-${formatCurrency(amt)}</span></div>`;
  }

  const taxRow =
    data.tax_rate > 0
      ? `<div class="t-row"><span class="t-label">Tax (${data.tax_rate}%)</span><span class="t-value">${formatCurrency(data.tax_amount)}</span></div>`
      : '';

  const footerParts: string[] = [];
  if (data.business_name) footerParts.push(`<strong>${esc(data.business_name)}</strong>`);
  if (data.business_phone) footerParts.push(esc(data.business_phone));
  if (data.business_email) footerParts.push(esc(data.business_email));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Estimate ${esc(data.estimate_number)}</title>
  <style>${pdfStyles}</style>
</head>
<body>
<div class="page-wrap">
  <div class="stripe"></div>
  <div class="page">
    <div class="doc-header">
      ${data.logo_url ? `<img src="${esc(data.logo_url)}" class="logo" alt="Logo" crossorigin="anonymous" />` : `<div class="biz-name-header">${esc(data.business_name)}</div>`}
      <div class="doc-type">ESTIMATE</div>
      <div class="doc-num">${data.memo ? esc(data.memo) : '#' + esc(data.estimate_number)}</div>
    </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${esc(data.business_name)}</div>
      ${contactBlock(data.business_address, data.business_phone, data.business_email)}
    </div>
    <div class="party">
      <div class="party-label">Prepared For</div>
      <div class="party-name">${esc(data.client_name)}</div>
      ${contactBlock(data.client_address, data.client_phone, data.client_email)}
    </div>
  </div>

  <div class="meta-bar">
    <div class="meta-item">
      <div class="meta-label">Issue Date</div>
      <div class="meta-value">${esc(data.issue_date)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Valid Until</div>
      <div class="meta-value">${esc(data.valid_until)}</div>
    </div>
  </div>

  <div class="grow">
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th class="r" style="width:70px">Qty</th>
          <th class="r" style="width:100px">Rate</th>
          <th class="r" style="width:110px">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals">
        <div class="t-row">
          <span class="t-label">Subtotal</span>
          <span class="t-value">${formatCurrency(data.subtotal)}</span>
        </div>
        ${discountRow}
        ${taxRow}
      </div>
    </div>
    <div class="grand-total-bar">
      <span>Total</span>
      <span>${formatCurrency(data.total)}</span>
    </div>

    ${data.notes ? `<div class="notes-box"><div class="notes-label">Notes / Terms</div><div class="notes-text">${esc(data.notes)}</div></div>` : ''}

    <div class="validity">This estimate is valid until ${esc(data.valid_until)}</div>
  </div>

  <div class="doc-footer">
    ${footerParts.join(' &nbsp;&middot;&nbsp; ')}
  </div>
</div>
</div>
</body>
</html>`;
};


function buildPdfStylesWithColors(accent: string, accentLight: string): string {
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.45;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page-wrap { display: flex; min-height: 100vh; max-width: 820px; margin: 0 auto; }
  .stripe { width: 48px; background: ${accent}; flex-shrink: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { flex: 1; padding: 48px 44px 48px 24px; display: flex; flex-direction: column; }
  .grow { flex: 1; }
  .doc-header { text-align: center; padding-bottom: 28px; border-bottom: 3px solid ${accent}; margin-bottom: 36px; }
  .logo { max-width: 200px; max-height: 72px; display: block; margin: 0 auto 8px; }
  .biz-name-header { font-size: 18px; font-weight: 700; color: ${accent}; margin-bottom: 8px; }
  .doc-type { font-size: 36px; font-weight: 800; color: ${accent}; letter-spacing: 4px; line-height: 1; margin-top: 4px; }
  .doc-num { font-size: 14px; color: #64748b; margin-top: 6px; }
  .parties { display: flex; gap: 48px; margin-bottom: 28px; }
  .party { flex: 1; }
  .party-label { font-size: 9px; font-weight: 700; color: ${accent}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  .party-name { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
  .contact-line { font-size: 12px; color: #64748b; line-height: 1.7; }
  .meta-bar { display: flex; background: ${accentLight}; border-radius: 6px; padding: 14px 20px; margin-bottom: 32px; gap: 36px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .meta-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; }
  .meta-value { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead th { background: ${accent}; color: #fff; padding: 11px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  thead th.r { text-align: right; }
  thead th:first-child { border-radius: 4px 0 0 0; }
  thead th:last-child { border-radius: 0 4px 0 0; }
  tbody td { padding: 13px 14px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .td-r { text-align: right; } .td-c { text-align: center; }
  .opt-badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 3px; margin-left: 6px; vertical-align: middle; text-transform: uppercase; }
  .item-discount { font-size: 11px; color: #16a34a; margin-top: 3px; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .totals { width: 280px; }
  .t-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; }
  .t-label { color: #64748b; } .t-value { font-weight: 600; color: #1e293b; }
  .t-row.discount .t-label, .t-row.discount .t-value { color: #16a34a; }
  .t-row.fee .t-label, .t-row.fee .t-value { color: #b45309; }
  .grand-total-bar { display: flex; justify-content: space-between; align-items: center; background: ${accent}; color: #fff; padding: 14px 24px; border-radius: 6px; margin-bottom: 28px; font-size: 20px; font-weight: 800; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .notes-box { background: #f8fafc; border-left: 4px solid ${accent}; padding: 16px 20px; border-radius: 0 6px 6px 0; margin-bottom: 32px; }
  .notes-label { font-size: 10px; font-weight: 700; color: ${accent}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .notes-text { font-size: 12px; color: #64748b; line-height: 1.7; white-space: pre-wrap; }
  .validity { text-align: center; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 12px; color: #92400e; font-weight: 600; margin-bottom: 32px; }
  .doc-footer { border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 10px; color: #94a3b8; line-height: 1.8; }
  .doc-footer strong { color: #64748b; }
  .custom-block { margin-bottom: 24px; font-size: 13px; color: #1e293b; line-height: 1.6; }
  .divider-block { border-top: 1px solid #e2e8f0; margin: 16px 0; }
  .spacer-block { height: 24px; }
  .payment-methods { margin-bottom: 28px; }
  .payment-methods-title { font-size: 10px; font-weight: 700; color: ${accent}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .payment-method-item { font-size: 12px; color: #1e293b; margin-bottom: 6px; }
  .payment-link { display: inline-block; background: ${accent}; color: #fff; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; margin-bottom: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `;
}

function renderBlocksToHtml(
  blocks: TemplateBlock[],
  data: InvoicePDFData | EstimatePDFData,
  docType: 'invoice' | 'estimate',
  accent: string,
  accentLight: string
): string {
  const isInvoice = docType === 'invoice';
  const inv = isInvoice ? (data as InvoicePDFData) : null;
  const est = isInvoice ? null : (data as EstimatePDFData);

  const sorted = [...blocks].filter(b => b.visible).sort((a, b) => a.order - b.order);
  const parts: string[] = [];

  for (const block of sorted) {
    switch (block.type) {
      case 'header': {
        const docNum = inv
          ? (inv.memo ? esc(inv.memo) : '#' + esc(inv.invoice_number))
          : '#' + esc(est!.estimate_number);
        parts.push(`<div class="doc-header">
          ${data.logo_url ? `<img src="${esc(data.logo_url)}" class="logo" alt="Logo" crossorigin="anonymous" />` : `<div class="biz-name-header">${esc(data.business_name)}</div>`}
          <div class="doc-type">${isInvoice ? 'INVOICE' : 'ESTIMATE'}</div>
          <div class="doc-num">${docNum}</div>
        </div>`);
        break;
      }
      case 'parties': {
        const billLabel = isInvoice ? 'Bill To' : 'Prepared For';
        parts.push(`<div class="parties">
          <div class="party"><div class="party-label">From</div><div class="party-name">${esc(data.business_name)}</div>${contactBlock(data.business_address, data.business_phone, data.business_email)}</div>
          <div class="party"><div class="party-label">${billLabel}</div><div class="party-name">${esc(data.client_name)}</div>${contactBlock(data.client_address, data.client_phone, data.client_email)}</div>
        </div>`);
        break;
      }
      case 'meta_bar': {
        if (inv) {
          parts.push(`<div class="meta-bar">
            <div class="meta-item"><div class="meta-label">Issue Date</div><div class="meta-value">${esc(inv.issue_date)}</div></div>
            <div class="meta-item"><div class="meta-label">Due Date</div><div class="meta-value">${esc(inv.due_date)}</div></div>
            <div class="meta-item"><div class="meta-label">Payment Terms</div><div class="meta-value">${esc(getPaymentTermsLabel(inv.payment_terms))}</div></div>
          </div>`);
        } else {
          parts.push(`<div class="meta-bar">
            <div class="meta-item"><div class="meta-label">Issue Date</div><div class="meta-value">${esc(est!.issue_date)}</div></div>
            <div class="meta-item"><div class="meta-label">Valid Until</div><div class="meta-value">${esc(est!.valid_until)}</div></div>
          </div>`);
        }
        break;
      }
      case 'line_items': {
        const rows = data.items.map((item: any) => {
          const optBadge = item.is_optional ? '<span class="opt-badge">Optional</span>' : '';
          let discLine = '';
          if (item.discount_amount && item.discount_amount > 0) {
            discLine = `<div class="item-discount">Discount: -${formatCurrency(item.discount_amount)}</div>`;
          } else if (item.discount_percentage && item.discount_percentage > 0) {
            discLine = `<div class="item-discount">Discount: -${item.discount_percentage}%</div>`;
          }
          return `<tr>
            <td>${esc(item.description)}${optBadge}${discLine}</td>
            <td class="td-c">${item.quantity}</td>
            <td class="td-r">${formatCurrency(item.unit_price)}</td>
            <td class="td-r" style="font-weight:600">${formatCurrency(item.total)}</td>
          </tr>`;
        }).join('');
        const colLabel = isInvoice ? 'Description' : 'Service';
        parts.push(`<table><thead><tr>
          <th>${colLabel}</th><th class="r" style="width:70px">Qty</th>
          <th class="r" style="width:100px">Rate</th><th class="r" style="width:110px">Amount</th>
        </tr></thead><tbody>${rows}</tbody></table>`);
        break;
      }
      case 'totals': {
        const taxRow = data.tax_rate > 0
          ? `<div class="t-row"><span class="t-label">Tax (${data.tax_rate}%)</span><span class="t-value">${formatCurrency(data.tax_amount)}</span></div>`
          : '';
        let extraRows = '';
        if (inv) {
          if (inv.late_fee_amount && inv.late_fee_amount > 0)
            extraRows += `<div class="t-row fee"><span class="t-label">Late Fee</span><span class="t-value">${formatCurrency(inv.late_fee_amount)}</span></div>`;
          if (inv.cc_fee_amount && inv.cc_fee_amount > 0)
            extraRows += `<div class="t-row"><span class="t-label">CC Fee (${inv.cc_fee_percent ?? 0}%)</span><span class="t-value">${formatCurrency(inv.cc_fee_amount)}</span></div>`;
        }
        if (est) {
          if (est.discount_amount && est.discount_amount > 0)
            extraRows += `<div class="t-row discount"><span class="t-label">Discount</span><span class="t-value">-${formatCurrency(est.discount_amount)}</span></div>`;
          else if (est.discount_percentage && est.discount_percentage > 0)
            extraRows += `<div class="t-row discount"><span class="t-label">Discount (${est.discount_percentage}%)</span><span class="t-value">-${formatCurrency(est.subtotal * (est.discount_percentage / 100))}</span></div>`;
        }
        parts.push(`<div class="totals-wrap"><div class="totals">
          <div class="t-row"><span class="t-label">Subtotal</span><span class="t-value">${formatCurrency(data.subtotal)}</span></div>
          ${extraRows}${taxRow}
        </div></div>
        <div class="grand-total-bar"><span>${isInvoice ? 'Total Due' : 'Total'}</span><span>${formatCurrency(data.total)}</span></div>`);
        break;
      }
      case 'notes': {
        if (data.notes) {
          parts.push(`<div class="notes-box"><div class="notes-label">Notes / Terms</div><div class="notes-text">${esc(data.notes)}</div></div>`);
        }
        break;
      }
      case 'payment_info': {
        if (inv) {
          const methods: string[] = [];
          if (inv.stripe_payment_link) methods.push(`<a href="${esc(inv.stripe_payment_link)}" class="payment-link">Pay Online</a>`);
          if (inv.venmo_username) methods.push(`<div class="payment-method-item"><strong>Venmo:</strong> @${esc(inv.venmo_username)}</div>`);
          if (inv.cashapp_username) methods.push(`<div class="payment-method-item"><strong>Cash App:</strong> $${esc(inv.cashapp_username)}</div>`);
          if (inv.zelle_email) methods.push(`<div class="payment-method-item"><strong>Zelle:</strong> ${esc(inv.zelle_email)}</div>`);
          if (inv.zelle_phone) methods.push(`<div class="payment-method-item"><strong>Zelle:</strong> ${esc(inv.zelle_phone)}</div>`);
          if (inv.check_payable_to) methods.push(`<div class="payment-method-item"><strong>Check payable to:</strong> ${esc(inv.check_payable_to)}</div>`);
          if (inv.check_mailing_address) methods.push(`<div class="payment-method-item">${esc(inv.check_mailing_address)}</div>`);
          if (methods.length > 0) {
            parts.push(`<div class="payment-methods"><div class="payment-methods-title">Payment Methods</div>${methods.join('')}</div>`);
          }
        }
        break;
      }
      case 'validity_notice': {
        if (est) {
          parts.push(`<div class="validity">This estimate is valid until ${esc(est.valid_until)}</div>`);
        }
        break;
      }
      case 'divider': {
        parts.push('<div class="divider-block"></div>');
        break;
      }
      case 'spacer': {
        parts.push('<div class="spacer-block"></div>');
        break;
      }
      case 'custom_text': {
        if (block.content) {
          parts.push(`<div class="custom-block">${block.content}</div>`);
        }
        break;
      }
    }
  }

  return parts.join('\n');
}

const PREVIEW_INVOICE_DATA: InvoicePDFData = {
  invoice_number: '1001',
  issue_date: 'Jan 1, 2026',
  due_date: 'Jan 31, 2026',
  client_name: 'Jane Smith',
  client_email: 'jane@example.com',
  client_phone: '(555) 123-4567',
  client_address: '456 Oak Ave, Springfield, IL 62701',
  business_name: 'Your Business Name',
  business_address: '123 Main St, Springfield, IL 62701',
  business_phone: '(555) 987-6543',
  business_email: 'hello@yourbusiness.com',
  items: [
    { description: 'Window Cleaning – Interior & Exterior', quantity: 1, unit_price: 250, total: 250 },
    { description: 'Screen Cleaning', quantity: 12, unit_price: 5, total: 60 },
  ],
  subtotal: 310,
  tax_rate: 8,
  tax_amount: 24.8,
  total: 334.8,
  notes: 'Thank you for your business!',
  payment_terms: 'net_30',
};

const PREVIEW_ESTIMATE_DATA: EstimatePDFData = {
  estimate_number: 'EST-1001',
  issue_date: 'Jan 1, 2026',
  valid_until: 'Jan 31, 2026',
  client_name: 'Jane Smith',
  client_email: 'jane@example.com',
  client_phone: '(555) 123-4567',
  client_address: '456 Oak Ave, Springfield, IL 62701',
  business_name: 'Your Business Name',
  business_address: '123 Main St, Springfield, IL 62701',
  business_phone: '(555) 987-6543',
  business_email: 'hello@yourbusiness.com',
  items: [
    { description: 'Window Cleaning – Interior & Exterior', quantity: 1, unit_price: 250, total: 250 },
    { description: 'Screen Cleaning', quantity: 12, unit_price: 5, total: 60 },
  ],
  subtotal: 310,
  tax_rate: 8,
  tax_amount: 24.8,
  total: 334.8,
  notes: 'Thank you for considering us!',
};

export function buildTemplatePreviewHtml(
  blocks: TemplateBlock[],
  accentColor: string,
  accentLightColor: string,
  docType: 'invoice' | 'estimate'
): string {
  const styles = buildPdfStylesWithColors(accentColor, accentLightColor);
  const data = docType === 'invoice' ? PREVIEW_INVOICE_DATA : PREVIEW_ESTIMATE_DATA;
  const body = renderBlocksToHtml(blocks, data, docType, accentColor, accentLightColor);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>${styles}</style></head>
<body><div class="page-wrap"><div class="stripe"></div><div class="page"><div class="grow">${body}</div></div></div></body></html>`;
}

export function generateInvoiceHTMLWithTemplate(
  data: InvoicePDFData,
  blocks: TemplateBlock[],
  accentColor: string,
  accentLightColor: string
): string {
  const styles = buildPdfStylesWithColors(accentColor, accentLightColor);
  const footerParts: string[] = [];
  if (data.business_name) footerParts.push(`<strong>${esc(data.business_name)}</strong>`);
  if (data.business_phone) footerParts.push(esc(data.business_phone));
  if (data.business_email) footerParts.push(esc(data.business_email));
  const body = renderBlocksToHtml(blocks, data, 'invoice', accentColor, accentLightColor);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(data.invoice_number)}</title><style>${styles}</style></head>
<body><div class="page-wrap"><div class="stripe"></div><div class="page">
<div class="grow">${body}</div>
<div class="doc-footer">${footerParts.join(' &nbsp;&middot;&nbsp; ')}</div>
</div></div></body></html>`;
}

export function generateEstimateHTMLWithTemplate(
  data: EstimatePDFData,
  blocks: TemplateBlock[],
  accentColor: string,
  accentLightColor: string
): string {
  const styles = buildPdfStylesWithColors(accentColor, accentLightColor);
  const footerParts: string[] = [];
  if (data.business_name) footerParts.push(`<strong>${esc(data.business_name)}</strong>`);
  if (data.business_phone) footerParts.push(esc(data.business_phone));
  if (data.business_email) footerParts.push(esc(data.business_email));
  const body = renderBlocksToHtml(blocks, data, 'estimate', accentColor, accentLightColor);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Estimate ${esc(data.estimate_number)}</title><style>${styles}</style></head>
<body><div class="page-wrap"><div class="stripe"></div><div class="page">
<div class="grow">${body}</div>
<div class="doc-footer">${footerParts.join(' &nbsp;&middot;&nbsp; ')}</div>
</div></div></body></html>`;
}

export const PDFGenerator = {
  async shareInvoicePDF(data: InvoicePDFData, templateConfig?: TemplatePDFConfig | null): Promise<boolean> {
    try {
      const html = templateConfig
        ? generateInvoiceHTMLWithTemplate(data, templateConfig.blocks, templateConfig.accent_color, templateConfig.accent_light_color)
        : generateInvoiceHTML(data);

      if (Platform.OS === 'web') {
        const { buildInvoicePDF, downloadPDF } = await import('./webPdfBuilder');
        const doc = await buildInvoicePDF(data);
        downloadPDF(doc, `Invoice_${data.invoice_number}`);
        return true;
      }

      const { uri } = await Print.printToFileAsync({ html });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${data.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sharing invoice PDF:', error);
      return false;
    }
  },

  async shareEstimatePDF(data: EstimatePDFData, templateConfig?: TemplatePDFConfig | null): Promise<boolean> {
    try {
      const html = templateConfig
        ? generateEstimateHTMLWithTemplate(data, templateConfig.blocks, templateConfig.accent_color, templateConfig.accent_light_color)
        : generateEstimateHTML(data);

      if (Platform.OS === 'web') {
        const { buildEstimatePDF, downloadPDF } = await import('./webPdfBuilder');
        const doc = await buildEstimatePDF(data);
        downloadPDF(doc, `Estimate_${data.estimate_number}`);
        return true;
      }

      const { uri } = await Print.printToFileAsync({ html });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Estimate ${data.estimate_number}`,
          UTI: 'com.adobe.pdf',
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sharing estimate PDF:', error);
      return false;
    }
  },
};
