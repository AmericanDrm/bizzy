import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function esc(s: string): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return `$${Number(n).toFixed(2)}`;
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

interface InvoiceData {
  invoice_number: string;
  memo: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  status: string;
  late_fee_amount: number | null;
  cc_fee_percent: number | null;
  cc_fee_amount: number | null;
  pdf_url: string | null;
  client_name: string;
  client_email: string;
  business_name: string;
  business_phone: string;
  business_email: string;
  logo_url: string | null;
  venmo_username: string | null;
  cashapp_username: string | null;
  zelle_email: string | null;
  zelle_phone: string | null;
  check_payable_to: string | null;
  check_mailing_address: string | null;
  stripe_payment_link: string | null;
}

async function loadInvoice(supabase: ReturnType<typeof getSupabase>, invoiceId: string): Promise<InvoiceData | null> {
  const { data: inv } = await supabase
    .from("invoices")
    .select(`
      invoice_number, memo, issue_date, due_date, subtotal, tax_rate, tax_amount,
      total, notes, status, late_fee_amount, cc_fee_percent, cc_fee_amount, pdf_url,
      client:clients(name, email),
      organization_id
    `)
    .eq("id", invoiceId)
    .maybeSingle();

  if (!inv) return null;

  const { data: biz } = await supabase
    .from("business_settings")
    .select(`
      business_name, business_phone, business_email, logo_url,
      venmo_username, cashapp_username, zelle_email, zelle_phone,
      check_payable_to, check_mailing_address, stripe_payment_link
    `)
    .eq("organization_id", inv.organization_id)
    .maybeSingle();

  return {
    invoice_number: inv.invoice_number,
    memo: inv.memo,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    subtotal: Number(inv.subtotal) || 0,
    tax_rate: Number(inv.tax_rate) || 0,
    tax_amount: Number(inv.tax_amount) || 0,
    total: Number(inv.total) || 0,
    notes: inv.notes || "",
    status: inv.status,
    late_fee_amount: inv.late_fee_amount ? Number(inv.late_fee_amount) : null,
    cc_fee_percent: inv.cc_fee_percent ? Number(inv.cc_fee_percent) : null,
    cc_fee_amount: inv.cc_fee_amount ? Number(inv.cc_fee_amount) : null,
    pdf_url: inv.pdf_url,
    client_name: inv.client?.name || "",
    client_email: inv.client?.email || "",
    business_name: biz?.business_name || "",
    business_phone: biz?.business_phone || "",
    business_email: biz?.business_email || "",
    logo_url: biz?.logo_url || null,
    venmo_username: biz?.venmo_username || null,
    cashapp_username: biz?.cashapp_username || null,
    zelle_email: biz?.zelle_email || null,
    zelle_phone: biz?.zelle_phone || null,
    check_payable_to: biz?.check_payable_to || null,
    check_mailing_address: biz?.check_mailing_address || null,
    stripe_payment_link: biz?.stripe_payment_link || null,
  };
}

function renderErrorPage(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;background:#f5f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:16px;padding:48px;max-width:480px;text-align:center;box-shadow:0 2px 20px rgba(0,0,0,.08)}
h2{margin:0 0 12px;color:#1d1d1f}p{color:#86868b;line-height:1.5}
</style></head><body><div class="card"><h2>Unable to Load Invoice</h2><p>${esc(message)}</p></div></body></html>`;
}

function renderPaymentPage(data: InvoiceData, pdfUrl: string | null) {
  const hasCcFee = (data.cc_fee_amount || 0) > 0;
  const baseTotal = hasCcFee ? data.total - (data.cc_fee_amount || 0) : data.total;
  const ccTotal = data.total;

  const dueStr = data.due_date
    ? new Date(data.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "N/A";
  const issueStr = data.issue_date
    ? new Date(data.issue_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  const invLabel = data.memo || `#${data.invoice_number}`;

  const paymentButtons: string[] = [];

  if (data.stripe_payment_link) {
    const label = hasCcFee ? "Pay by Card" : "Pay by Card";
    paymentButtons.push(
      `<a href="${esc(data.stripe_payment_link)}" class="pay-btn stripe" target="_blank" rel="noopener">` +
      `<span class="pay-icon">💳</span><span class="pay-text">${label}</span><span class="pay-amount">${fmt(ccTotal)}</span></a>`
    );
  }

  if (data.venmo_username) {
    const handle = data.venmo_username.replace(/^@/, "");
    const note = encodeURIComponent(`Invoice ${invLabel}`);
    const venmoUrl = `https://venmo.com/${handle}?txn=pay&amount=${baseTotal.toFixed(2)}&note=${note}`;
    paymentButtons.push(
      `<a href="${esc(venmoUrl)}" class="pay-btn venmo" target="_blank" rel="noopener">` +
      `<span class="pay-icon">V</span><span class="pay-text">Venmo</span><span class="pay-amount">${fmt(baseTotal)}</span></a>`
    );
  }

  if (data.cashapp_username) {
    const tag = data.cashapp_username.replace(/^\$/, "");
    const cashUrl = `https://cash.app/$${tag}/${baseTotal.toFixed(2)}`;
    paymentButtons.push(
      `<a href="${esc(cashUrl)}" class="pay-btn cashapp" target="_blank" rel="noopener">` +
      `<span class="pay-icon">$</span><span class="pay-text">Cash App</span><span class="pay-amount">${fmt(baseTotal)}</span></a>`
    );
  }

  if (data.zelle_email || data.zelle_phone) {
    const zelleTarget = data.zelle_email || data.zelle_phone || "";
    const zelleType = data.zelle_email ? "email" : "phone";
    paymentButtons.push(
      `<div class="pay-btn zelle">` +
      `<span class="pay-icon">Z</span><span class="pay-text">Zelle (${esc(zelleType)}: ${esc(zelleTarget)})</span><span class="pay-amount">${fmt(baseTotal)}</span></div>`
    );
  }

  if (data.check_payable_to) {
    let checkDetail = `Payable to: ${esc(data.check_payable_to)}`;
    if (data.check_mailing_address) checkDetail += `<br><span class="check-addr">Mail to: ${esc(data.check_mailing_address)}</span>`;
    paymentButtons.push(
      `<div class="pay-btn check">` +
      `<span class="pay-icon">✓</span><span class="pay-text">Check</span><span class="pay-amount">${fmt(baseTotal)}</span>` +
      `<div class="check-detail">${checkDetail}</div></div>`
    );
  }

  const paymentSection = paymentButtons.length > 0
    ? `<div class="section"><h2>Pay Now</h2><div class="pay-list">${paymentButtons.join("")}</div></div>`
    : "";

  const pdfSection = pdfUrl
    ? `<div class="section"><a href="${esc(pdfUrl)}" class="pdf-btn" target="_blank" rel="noopener"><span class="pdf-icon">📄</span> View Invoice PDF</a></div>`
    : "";

  const notesSection = data.notes
    ? `<div class="section notes"><div class="notes-label">Notes</div><div class="notes-text">${esc(data.notes)}</div></div>`
    : "";

  const logoHtml = data.logo_url
    ? `<img src="${esc(data.logo_url)}" class="logo" alt="Logo">`
    : "";

  const paidBanner = data.status === "paid"
    ? `<div class="paid-banner">✓ This invoice has been paid</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(invLabel)} - ${esc(data.business_name)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;color:#1d1d1f;line-height:1.5;-webkit-font-smoothing:antialiased}
.page{max-width:520px;margin:0 auto;padding:16px 12px 48px}
.header{background:linear-gradient(135deg,#1a3c5e,#0f2942);color:#fff;border-radius:16px;padding:32px 24px;text-align:center;margin-bottom:20px;box-shadow:0 4px 12px rgba(0,0,0,.1)}
.logo{max-width:140px;max-height:50px;margin-bottom:12px;border-radius:8px}
.biz-name{font-size:22px;font-weight:700;margin-bottom:4px;letter-spacing:.3px}
.inv-title{font-size:14px;opacity:.85;margin-bottom:2px}
.inv-num{font-size:13px;opacity:.7}
.card{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 1px 8px rgba(0,0,0,.06)}
.meta-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}
.meta-label{color:#86868b}
.meta-value{font-weight:600}
.divider{border-top:1px solid #f0f0f0;margin:12px 0}
.total-row{display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:2px solid #1a3c5e;margin-top:8px}
.total-label{font-size:17px;font-weight:700;color:#1a3c5e}
.total-value{font-size:24px;font-weight:800;color:#1a3c5e}
.section{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 1px 8px rgba(0,0,0,.06)}
.section h2{font-size:16px;font-weight:600;margin-bottom:16px;color:#1d1d1f}
.pay-list{display:flex;flex-direction:column;gap:12px}
.pay-btn{display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;text-decoration:none;transition:transform .15s,box-shadow .15s;cursor:pointer;border:none;width:100%;font-family:inherit}
.pay-btn:active{transform:scale(.98)}
.pay-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;flex-shrink:0;color:#fff}
.pay-text{flex:1;text-align:left;font-size:16px;font-weight:600;color:#1d1d1f}
.pay-amount{font-size:16px;font-weight:700;color:#1d1d1f;flex-shrink:0}
.pay-btn.stripe{background:#f0f4ff}.pay-btn.stripe .pay-icon{background:#635bff}
.pay-btn.venmo{background:#e8f5fd}.pay-btn.venmo .pay-icon{background:#3d95ce;color:#fff;font-style:italic}
.pay-btn.cashapp{background:#e8f8ee}.pay-btn.cashapp .pay-icon{background:#00d632}
.pay-btn.zelle{background:#fdf3e8}.pay-btn.zelle .pay-icon{background:#f60}
.pay-btn.check{background:#f5f5f7}.pay-btn.check .pay-icon{background:#86868b}
.check-detail{width:100%;font-size:13px;color:#86868b;margin-top:8px;padding-top:8px;border-top:1px solid #f0f0f0;line-height:1.6}
.check-addr{display:block;margin-top:2px}
.pdf-btn{display:flex;align-items:center;justify-content:center;gap:10px;padding:16px;border-radius:14px;background:#1a3c5e;color:#fff;text-decoration:none;font-size:16px;font-weight:600;transition:background .2s}
.pdf-btn:active{background:#0f2942}
.notes-label{font-size:12px;font-weight:700;color:#86868b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.notes-text{font-size:14px;color:#1d1d1f;line-height:1.6;white-space:pre-wrap}
.paid-banner{background:#e8f8ee;color:#1a7c30;padding:12px 16px;border-radius:12px;font-size:15px;font-weight:600;text-align:center;margin-bottom:16px;border:1px solid #c3e6cb}
.footer{text-align:center;font-size:12px;color:#86868b;padding:16px 0;line-height:1.8}
.footer a{color:#1a3c5e;text-decoration:none}
</style></head><body>
<div class="page">
  <div class="header">
    ${logoHtml}
    <div class="biz-name">${esc(data.business_name)}</div>
    <div class="inv-title">Invoice</div>
    <div class="inv-num">${esc(invLabel)}</div>
  </div>

  ${paidBanner}

  <div class="card">
    <div class="meta-row"><span class="meta-label">Billed To</span><span class="meta-value">${esc(data.client_name)}</span></div>
    <div class="meta-row"><span class="meta-label">Issued</span><span class="meta-value">${esc(issueStr)}</span></div>
    <div class="meta-row"><span class="meta-label">Due</span><span class="meta-value">${esc(dueStr)}</span></div>
    <div class="divider"></div>
    <div class="meta-row"><span class="meta-label">Subtotal</span><span class="meta-value">${fmt(data.subtotal)}</span></div>
    ${data.tax_rate > 0 ? `<div class="meta-row"><span class="meta-label">Tax (${data.tax_rate}%)</span><span class="meta-value">${fmt(data.tax_amount)}</span></div>` : ""}
    ${(data.late_fee_amount || 0) > 0 ? `<div class="meta-row"><span class="meta-label">Late Fee</span><span class="meta-value">${fmt(data.late_fee_amount!)}</span></div>` : ""}
    ${hasCcFee ? `<div class="meta-row"><span class="meta-label">CC Fee (${data.cc_fee_percent || 0}%)</span><span class="meta-value">${fmt(data.cc_fee_amount || 0)}</span></div>` : ""}
    <div class="total-row"><span class="total-label">Total Due</span><span class="total-value">${fmt(data.total)}</span></div>
  </div>

  ${paymentSection}

  ${pdfSection}

  ${notesSection}

  <div class="footer">
    ${esc(data.business_name)}${data.business_phone ? ` &middot; ${esc(data.business_phone)}` : ""}<br>
    ${data.business_email ? `<a href="mailto:${esc(data.business_email)}">${esc(data.business_email)}</a>` : ""}
  </div>
</div>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response(renderErrorPage("Missing invoice code."), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const supabase = getSupabase();

    const { data: link, error: linkErr } = await supabase
      .from("short_links")
      .select("document_id, document_type, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (linkErr || !link) {
      return new Response(renderErrorPage("Invoice link not found."), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    if (new Date(link.expires_at) < new Date()) {
      return new Response(renderErrorPage("This invoice link has expired."), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    if (link.document_type !== "invoice") {
      return new Response(renderErrorPage("This link is not for an invoice."), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const invoice = await loadInvoice(supabase, link.document_id);
    if (!invoice) {
      return new Response(renderErrorPage("Invoice not found."), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const html = renderPaymentPage(invoice, invoice.pdf_url);

    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("payment-page error:", err);
    return new Response(renderErrorPage("Internal server error."), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }
});
