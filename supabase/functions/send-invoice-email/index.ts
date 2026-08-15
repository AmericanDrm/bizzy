import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_FROM_EMAIL = "notifications@bizzypro.app";
const DEFAULT_DOMAIN = "bizzypro.app";
const ACCENT = "#1a3c5e";

interface EmailPayload {
  invoiceId: string;
  clientEmail: string;
  clientName: string;
  sendToSelf?: boolean;
  pdfBase64?: string;
  checkoutUrl?: string;
  googleReviewUrl?: string;
}

interface PaymentMethods {
  stripePaymentLink?: string;
  venmoUsername?: string;
  cashappUsername?: string;
  zelleEmail?: string;
  zellePhone?: string;
  checkPayableTo?: string;
  checkMailingAddress?: string;
}

async function getEmailConfig(
  supabase: any,
  organizationId: string
): Promise<{ apiKey: string | null; fallbackApiKey: string | null; fromName: string; fromEmail: string; sendingDomain: string; error?: string; settingsId?: string }> {
  const envKey = Deno.env.get("MAILGUN_API_KEY");

  const { data: settings } = await supabase
    .from("tenant_email_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const hasCustomDomain = settings?.domain_id &&
    settings?.sending_domain?.toLowerCase() !== DEFAULT_DOMAIN &&
    settings?.is_active &&
    settings?.mailgun_api_key_encrypted;

  if (hasCustomDomain) {
    try {
      const { data: encryptionSecret } = await supabase.rpc("get_email_encryption_key");
      if (encryptionSecret) {
        const { data: decryptedKey } = await supabase.rpc("decrypt_api_key", {
          encrypted_key: settings.mailgun_api_key_encrypted,
          encryption_secret: encryptionSecret,
        });
        if (decryptedKey) {
          const domain = settings.sending_domain.toLowerCase();
          return {
            apiKey: decryptedKey,
            fallbackApiKey: envKey || null,
            fromName: settings.custom_from_name || "Your Business",
            fromEmail: (settings.custom_from_email || `noreply@${domain}`).toLowerCase(),
            sendingDomain: domain,
            settingsId: settings.id,
          };
        }
      }
    } catch (e) {
      console.error("Custom domain key decryption failed:", e);
    }
  }

  const masterKey = envKey || settings?.mailgun_master_api_key;
  const fallback = (!envKey && settings?.mailgun_master_api_key) ? settings.mailgun_master_api_key : null;

  if (!masterKey) {
    return { apiKey: null, fallbackApiKey: null, fromName: "", fromEmail: "", sendingDomain: DEFAULT_DOMAIN, error: "Email service not configured. Contact support." };
  }

  return {
    apiKey: masterKey,
    fallbackApiKey: fallback,
    fromName: settings?.custom_from_name || "Your Business",
    fromEmail: DEFAULT_FROM_EMAIL,
    sendingDomain: DEFAULT_DOMAIN,
    settingsId: settings?.id,
  };
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

async function sendWithMailgun(
  apiKey: string,
  sendingDomain: string,
  payload: Record<string, string>,
  attachment?: { base64: string; filename: string },
): Promise<Response> {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  if (attachment) {
    const blob = base64ToBlob(attachment.base64, "application/pdf");
    form.append("attachment", blob, attachment.filename);
  }
  return fetch(`https://api.mailgun.net/v3/${sendingDomain}/messages`, {
    method: "POST",
    headers: { "Authorization": `Basic ${btoa(`api:${apiKey}`)}` },
    body: form,
  });
}

async function sendEmailWithRetry(
  emailConfig: { apiKey: string; fallbackApiKey: string | null; sendingDomain: string; settingsId?: string },
  mgPayload: Record<string, string>,
  supabase: any,
  attachment?: { base64: string; filename: string },
): Promise<{ response: Response; usedFallback: boolean }> {
  const MAX_RETRIES = 2;
  const RETRY_DELAYS = [1000, 2000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await sendWithMailgun(emailConfig.apiKey, emailConfig.sendingDomain, mgPayload, attachment);
    if (response.ok) return { response, usedFallback: false };

    if (response.status === 401 && emailConfig.fallbackApiKey) {
      console.warn("Primary key returned 401, trying fallback");
      const fallbackResponse = await sendWithMailgun(emailConfig.fallbackApiKey, emailConfig.sendingDomain, mgPayload, attachment);
      if (fallbackResponse.ok && emailConfig.settingsId) {
        await supabase.from("tenant_email_settings")
          .update({ mailgun_master_api_key: emailConfig.fallbackApiKey })
          .eq("id", emailConfig.settingsId);
      }
      return { response: fallbackResponse, usedFallback: true };
    }

    if (response.status >= 500 && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    return { response, usedFallback: false };
  }

  return { response: await sendWithMailgun(emailConfig.apiKey, emailConfig.sendingDomain, mgPayload, attachment), usedFallback: false };
}

function esc(s: string): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function getTermsLabel(t: string | undefined): string {
  switch (t) {
    case "due_on_receipt": return "Due on Receipt";
    case "net_15": return "Net 15";
    case "net_30": return "Net 30";
    case "net_60": return "Net 60";
    case "net_90": return "Net 90";
    default: return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n").replace(/<\/td>/gi, "  ").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, "-")
    .replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function buildPaymentMethodHtml(
  method: string,
  label: string,
  amount: string,
  details: string,
  linkUrl?: string,
): string {
  const methodStyle = `display:inline-block;padding:12px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;width:100%;box-sizing:border-box;`;
  const labelStyle = `font-size:14px;font-weight:700;color:#1e293b;`;
  const amountStyle = `font-size:16px;font-weight:800;color:${ACCENT};`;
  const detailStyle = `font-size:13px;color:#64748b;margin-top:4px;line-height:1.5;`;

  if (linkUrl) {
    return `<tr><td style="padding:0 0 12px 0;">
      <a href="${esc(linkUrl)}" target="_blank" style="display:block;padding:14px 20px;background:${ACCENT};border-radius:8px;text-decoration:none;text-align:center;">
        <div style="font-size:14px;font-weight:700;color:#ffffff;">${label}</div>
        <div style="font-size:18px;font-weight:800;color:#ffffff;margin-top:4px;">${amount}</div>
        ${details ? `<div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">${details}</div>` : ""}
      </a>
    </td></tr>`;
  }

  return `<tr><td style="padding:0 0 12px 0;">
    <div style="${methodStyle}">
      <div style="${labelStyle}">${label}</div>
      <div style="${amountStyle}">${amount}</div>
      ${details ? `<div style="${detailStyle}">${details}</div>` : ""}
    </div>
  </td></tr>`;
}

function buildPaymentOptionsHtml(
  invoice: any,
  paymentMethods: PaymentMethods,
  businessCcFeePercent?: number,
): string {
  const ccFeeAmount = Number(invoice.cc_fee_amount) || 0;
  const totalWithFee = Number(invoice.total);
  const totalWithoutFee = ccFeeAmount > 0 ? totalWithFee - ccFeeAmount : totalWithFee;
  const hasCcFee = ccFeeAmount > 0;

  const hasAnyMethod = paymentMethods.stripePaymentLink ||
    paymentMethods.venmoUsername ||
    paymentMethods.cashappUsername ||
    paymentMethods.zelleEmail ||
    paymentMethods.zellePhone ||
    paymentMethods.checkPayableTo;

  if (!hasAnyMethod) return "";

  const invoiceNum = invoice.invoice_number || "";
  const methods: string[] = [];

  if (paymentMethods.stripePaymentLink) {
    const cardLabel = hasCcFee ? "Pay Online by Card (includes processing fee)" : "Pay Online by Card";
    const cardDetails = hasCcFee
      ? `Secure payment via Stripe &middot; includes ${invoice.cc_fee_percent ?? businessCcFeePercent ?? 0}% card processing fee`
      : "Secure payment via Stripe";
    methods.push(buildPaymentMethodHtml(
      "card", cardLabel, fmt(totalWithFee),
      cardDetails,
      paymentMethods.stripePaymentLink,
    ));
  }

  if (paymentMethods.venmoUsername) {
    const handle = paymentMethods.venmoUsername.replace(/^@/, "");
    const venmoUrl = `https://venmo.com/${encodeURIComponent(handle)}?txn=pay&amount=${totalWithoutFee.toFixed(2)}&note=${encodeURIComponent(`Invoice #${invoiceNum}`)}`;
    const venmoLabel = hasCcFee ? "Pay with Venmo (Cash Price)" : "Pay with Venmo";
    methods.push(buildPaymentMethodHtml(
      "venmo", venmoLabel, fmt(totalWithoutFee),
      `Send to @${esc(handle)}`,
      venmoUrl,
    ));
  }

  if (paymentMethods.cashappUsername) {
    const tag = paymentMethods.cashappUsername.replace(/^\$/, "");
    const cashappUrl = `https://cash.app/$${encodeURIComponent(tag)}/${totalWithoutFee.toFixed(2)}`;
    const cashappLabel = hasCcFee ? "Pay with Cash App (Cash Price)" : "Pay with Cash App";
    methods.push(buildPaymentMethodHtml(
      "cashapp", cashappLabel, fmt(totalWithoutFee),
      `Send to $${esc(tag)}`,
      cashappUrl,
    ));
  }

  if (paymentMethods.zelleEmail || paymentMethods.zellePhone) {
    const zelleTarget = paymentMethods.zelleEmail
      ? esc(paymentMethods.zelleEmail)
      : esc(paymentMethods.zellePhone!);
    const zelleType = paymentMethods.zelleEmail ? "email" : "phone";
    const zelleLabel = hasCcFee ? "Pay with Zelle (Cash Price)" : "Pay with Zelle";
    methods.push(buildPaymentMethodHtml(
      "zelle", zelleLabel, fmt(totalWithoutFee),
      `Send to ${zelleType}: ${zelleTarget}<br/>Memo: Invoice #${esc(invoiceNum)}`,
    ));
  }

  if (paymentMethods.checkPayableTo) {
    const checkDetails = [
      `Make payable to: ${esc(paymentMethods.checkPayableTo)}`,
      paymentMethods.checkMailingAddress ? `Mail to: ${esc(paymentMethods.checkMailingAddress)}` : "",
      `Memo: Invoice #${esc(invoiceNum)}`,
    ].filter(Boolean).join("<br/>");
    const checkLabel = hasCcFee ? "Pay by Check (Cash Price)" : "Pay by Check";
    methods.push(buildPaymentMethodHtml(
      "check", checkLabel, fmt(totalWithoutFee),
      checkDetails,
    ));
  }

  return `<div style="margin-bottom:24px;">
    <div style="font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid ${ACCENT};">How to Pay</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${methods.join("")}
    </table>
  </div>`;
}

function buildGoogleReviewSection(googleReviewUrl: string): string {
  return `<div style="margin-bottom:24px;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center;">
    <div style="font-size:22px;margin-bottom:8px;">&#11088;</div>
    <div style="font-size:15px;font-weight:700;color:#166534;margin-bottom:6px;">How are we doing?</div>
    <div style="font-size:13px;color:#15803d;margin-bottom:14px;line-height:1.5;">We'd love to hear your feedback! Leaving a review takes just a minute and means the world to us.</div>
    <a href="${esc(googleReviewUrl)}" target="_blank" style="display:inline-block;padding:10px 24px;background:#059669;color:#ffffff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;">Leave a Google Review</a>
  </div>`;
}

function buildCcFeeNoticeBanner(ccFeePercent: number, feeAlreadyIncluded: boolean): string {
  if (feeAlreadyIncluded) {
    return `<div style="margin-bottom:24px;padding:14px 18px;background:#f0f9ff;border:2px solid #0ea5e9;border-radius:10px;display:flex;align-items:flex-start;">
      <div style="font-size:20px;margin-right:12px;line-height:1;">&#128179;</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#0369a1;margin-bottom:2px;">Card Processing Fee Included</div>
        <div style="font-size:13px;color:#0c4a6e;line-height:1.5;">A ${ccFeePercent}% card processing fee is already included in the total shown above.</div>
      </div>
    </div>`;
  }
  return `<div style="margin-bottom:24px;padding:16px 18px;background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;">
    <div style="display:table;width:100%;">
      <div style="display:table-cell;vertical-align:middle;width:32px;font-size:22px;line-height:1;">&#9888;&#65039;</div>
      <div style="display:table-cell;vertical-align:middle;padding-left:10px;">
        <div style="font-size:13px;font-weight:800;color:#92400e;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Credit Card Fee Notice</div>
        <div style="font-size:14px;color:#78350f;line-height:1.6;">If you are paying by credit or debit card, a <strong>${ccFeePercent}% processing fee</strong> will be added at checkout. To avoid this fee, please pay by check, cash, Venmo, Zelle, or another non-card method.</div>
      </div>
    </div>
  </div>`;
}

function buildInvoiceEmailHtml(
  invoice: any, items: any[], businessName: string, businessPhone: string,
  businessEmail: string, businessAddress: string, clientName: string,
  customMessage: string, unsubscribeUrl: string, paymentMethods: PaymentMethods,
  logoUrl?: string,
  googleReviewUrl?: string,
  showCcFeeNotice?: boolean,
  ccFeePercent?: number,
  pdfUrl?: string,
): string {
  const isPastDue = new Date(invoice.due_date) < new Date() && invoice.payment_status !== "paid";
  const isPaid = invoice.payment_status === "paid";
  const statusText = isPaid ? "PAID" : isPastDue ? "PAST DUE" : "PENDING";
  const statusBg = isPaid ? "#059669" : isPastDue ? "#dc2626" : "#d97706";

  const itemRows = items.map((item: any) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">${esc(item.description)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:14px;color:#1e293b;">${item.quantity}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:#1e293b;">${fmt(item.unit_price)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(item.total)}</td>
    </tr>`).join("");

  const taxRow = Number(invoice.tax_rate) > 0
    ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Tax (${invoice.tax_rate}%)</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(invoice.tax_amount)}</td></tr>` : "";
  const lateFeeRow = Number(invoice.late_fee) > 0
    ? `<tr><td style="padding:6px 0;font-size:14px;color:#b45309;">Late Fee</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#b45309;">${fmt(invoice.late_fee)}</td></tr>` : "";
  const ccFeeRow = Number(invoice.cc_fee_amount) > 0
    ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">CC Processing Fee (${invoice.cc_fee_percent ?? 0}%)</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(invoice.cc_fee_amount)}</td></tr>` : "";

  const issueDate = new Date(invoice.issue_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const dueDate = new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const termsLabel = getTermsLabel(invoice.payment_terms);

  const paymentOptionsHtml = !isPaid ? buildPaymentOptionsHtml(invoice, paymentMethods, ccFeePercent) : "";

  const ccFeeNoticeHtml = (() => {
    if (!showCcFeeNotice || !ccFeePercent || isPaid) return "";
    const feeAlreadyIncluded = Number(invoice.cc_fee_amount) > 0;
    return buildCcFeeNoticeBanner(ccFeePercent, feeAlreadyIncluded);
  })();

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice #${esc(invoice.invoice_number)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr><td style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
        <tr><td style="background:${ACCENT};padding:36px 32px;border-radius:12px 12px 0 0;text-align:center;">
          ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" style="max-width:160px;max-height:60px;margin-bottom:12px;" />` : ""}
          <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px;">${esc(businessName)}</div>
          ${pdfUrl
            ? `<a href="${esc(pdfUrl)}" target="_blank" style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:6px;display:block;text-decoration:underline;">Invoice ${invoice.memo ? esc(invoice.memo) : '#' + esc(invoice.invoice_number)}</a>`
            : `<div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px;">Invoice ${invoice.memo ? esc(invoice.memo) : '#' + esc(invoice.invoice_number)}</div>`
          }
          <div style="display:inline-block;margin-top:12px;padding:5px 18px;border-radius:20px;background:${statusBg};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;">${statusText}</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:32px;">
          ${pdfUrl ? `<div style="margin-bottom:24px;"><a href="${esc(pdfUrl)}" target="_blank" style="display:block;padding:14px 20px;background:${ACCENT};border-radius:8px;text-decoration:none;text-align:center;"><div style="font-size:14px;font-weight:700;color:#ffffff;">View Invoice PDF</div><div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:3px;">Tap to open &amp; download</div></a></div>` : ""}
          ${customMessage
            ? `<div style="margin-bottom:24px;padding:16px 20px;background:#f8fafc;border-radius:8px;font-size:14px;color:#1e293b;line-height:1.6;">${customMessage}</div>`
            : isPaid
              ? `<p style="font-size:15px;color:#1e293b;margin:0 0 8px;">Hello ${esc(clientName)},</p><p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.6;">Thank you for your payment! This invoice has been paid in full.</p>`
              : (() => {
                  const ccFeeAmt = Number(invoice.cc_fee_amount) || 0;
                  const totalAmt = Number(invoice.total);
                  const baseAmt = ccFeeAmt > 0 ? totalAmt - ccFeeAmt : totalAmt;
                  const invoiceRef = invoice.memo ? esc(invoice.memo) : `#${esc(invoice.invoice_number)}`;
                  if (ccFeeAmt > 0) {
                    return `<p style="font-size:15px;color:#1e293b;margin:0 0 8px;">Hello ${esc(clientName)},</p><p style="font-size:15px;color:#64748b;margin:0 0 12px;line-height:1.6;">Please find your invoice ${invoiceRef} below.</p><div style="margin-bottom:24px;padding:16px 20px;background:#f8fafc;border-radius:8px;border-left:4px solid #059669;"><div style="font-size:13px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Cash, Check, Venmo, Zelle Price</div><div style="font-size:22px;font-weight:800;color:#1e293b;">${fmt(baseAmt)}</div><div style="font-size:12px;color:#64748b;margin-top:4px;">Pay by card: ${fmt(totalAmt)} (includes ${invoice.cc_fee_percent ?? 0}% processing fee)</div></div>`;
                  }
                  return `<p style="font-size:15px;color:#1e293b;margin:0 0 8px;">Hello ${esc(clientName)},</p><p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.6;">Please find your invoice ${invoiceRef} below.</p>`;
                })()
          }
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f8fafc;border-radius:8px;">
            <tr>
              <td style="padding:14px 20px;"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Issue Date</div><div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:3px;">${issueDate}</div></td>
              <td style="padding:14px 20px;"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Due Date</div><div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:3px;">${dueDate}</div></td>
              ${termsLabel ? `<td style="padding:14px 20px;"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Terms</div><div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:3px;">${termsLabel}</div></td>` : ""}
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <thead>
              <tr>
                <th style="background:${ACCENT};color:#fff;padding:10px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:left;border-radius:4px 0 0 0;">Description</th>
                <th style="background:${ACCENT};color:#fff;padding:10px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:center;">Qty</th>
                <th style="background:${ACCENT};color:#fff;padding:10px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:right;">Rate</th>
                <th style="background:${ACCENT};color:#fff;padding:10px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:right;border-radius:0 4px 0 0;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-left:auto;margin-bottom:24px;min-width:260px;">
            <tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Subtotal</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(invoice.subtotal)}</td></tr>
            ${taxRow}${lateFeeRow}${ccFeeRow}
            <tr><td colspan="2" style="padding:0;"><div style="border-top:3px solid ${ACCENT};margin:10px 0;"></div></td></tr>
            <tr><td style="padding:6px 0;font-size:20px;font-weight:800;color:#1e293b;">Total Due</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:20px;font-weight:800;color:${ACCENT};">${fmt(invoice.total)}</td></tr>
          </table>
          ${ccFeeNoticeHtml}
          ${paymentOptionsHtml}
          ${!isPaid && invoice.payment_method ? `<div style="margin-bottom:24px;padding:16px 20px;background:#fffbeb;border-left:4px solid #d97706;border-radius:0 8px 8px 0;"><div style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Payment Instructions</div><div style="font-size:13px;color:#1e293b;line-height:1.6;">${esc(invoice.payment_method)}</div></div>` : ""}
          ${invoice.notes ? `<div style="margin-bottom:24px;padding:16px 20px;background:#f8fafc;border-left:4px solid ${ACCENT};border-radius:0 8px 8px 0;"><div style="font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Notes</div><div style="font-size:13px;color:#64748b;line-height:1.6;">${esc(invoice.notes)}</div></div>` : ""}
          ${!isPaid && isPastDue ? `<div style="text-align:center;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:14px;color:#dc2626;font-weight:600;margin-bottom:24px;">This invoice is past due. Please submit payment as soon as possible.</div>` : ""}
          ${googleReviewUrl ? buildGoogleReviewSection(googleReviewUrl) : ""}
          ${!customMessage ? `<p style="font-size:14px;color:#64748b;margin:0 0 4px;">If you have any questions, don't hesitate to reach out.</p><p style="font-size:14px;color:#1e293b;margin:0;">Best regards,<br/><strong>${esc(businessName)}</strong></p>` : ""}
        </td></tr>
        <tr><td style="padding:24px 32px;text-align:center;background:#f8fafc;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
          <div style="font-size:12px;color:#94a3b8;line-height:1.8;"><strong style="color:#64748b;">${esc(businessName)}</strong>${businessPhone ? ` &middot; ${esc(businessPhone)}` : ""}${businessEmail ? ` &middot; ${esc(businessEmail)}` : ""}</div>
          ${businessAddress ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;">${esc(businessAddress)}</div>` : ""}
          <div style="margin-top:12px;font-size:11px;color:#94a3b8;"><a href="${esc(unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> from future emails from ${esc(businessName)}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function createStripeCheckoutForInvoice(
  invoice: any,
  businessName: string,
  stripeSecretKey: string,
  supabase: any,
): Promise<string | null> {
  try {
    const totalCents = Math.round(Number(invoice.total) * 100);
    if (totalCents <= 0) return null;

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    const lineItems = (invoice.invoice_items || [])
      .filter((item: any) => Number(item.unit_price) > 0)
      .map((item: any) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.description || "Service" },
          unit_amount: Math.round(Number(item.unit_price) * 100),
        },
        quantity: Number(item.quantity) || 1,
      }));

    if (lineItems.length === 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `Invoice #${invoice.invoice_number}` },
          unit_amount: totalCents,
        },
        quantity: 1,
      });
    }

    const appUrl = "https://bizzypro.app";
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${appUrl}/approve/${invoice.id}?stripe_success=true`,
      cancel_url: `${appUrl}/approve/${invoice.id}?stripe_cancel=true`,
      metadata: {
        invoice_id: invoice.id,
        organization_id: invoice.organization_id,
        invoice_number: invoice.invoice_number,
      },
      payment_intent_data: {
        metadata: { invoice_id: invoice.id, organization_id: invoice.organization_id },
        description: `${businessName} - Invoice #${invoice.invoice_number}`,
      },
    };

    if (invoice.clients?.email) {
      sessionParams.customer_email = invoice.clients.email.toLowerCase();
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store session ID so webhook can match payment back to this invoice
    await supabase
      .from("invoices")
      .update({ stripe_session_id: session.id })
      .eq("id", invoice.id);

    return session.url;
  } catch (e) {
    console.error("Failed to create Stripe checkout session:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== serviceRoleKey) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(JSON.stringify({ success: false, error: "Invalid or expired authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const payload: EmailPayload = await req.json();
    const { invoiceId, clientEmail, clientName, sendToSelf, pdfBase64, checkoutUrl, googleReviewUrl: payloadGoogleReviewUrl } = payload;

    if (!invoiceId || !clientEmail) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields: invoiceId, clientEmail" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").select("*, pdf_url, invoice_items(*), clients(email)").eq("id", invoiceId).single();
    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ success: false, error: "Failed to fetch invoice" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalizedEmail = clientEmail.toLowerCase().trim();
    const { data: unsubRecord } = await supabase.from("email_unsubscribes").select("id").eq("organization_id", invoice.organization_id).ilike("email", normalizedEmail).maybeSingle();
    if (unsubRecord) {
      return new Response(JSON.stringify({ success: false, error: "This client has unsubscribed from your emails. They will need to re-subscribe before you can send to them.", unsubscribed: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailConfig = await getEmailConfig(supabase, invoice.organization_id);
    if (!emailConfig.apiKey) {
      return new Response(JSON.stringify({ success: false, error: emailConfig.error, needsSetup: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: businessSettings } = await supabase.from("business_settings")
      .select("business_name, business_email, business_phone, business_address, logo_url, stripe_payment_link, venmo_username, cashapp_username, zelle_email, zelle_phone, check_payable_to, check_mailing_address, google_review_url, include_google_review_on_invoice, show_cc_fee_notice, cc_processing_fee_percent")
      .eq("organization_id", invoice.organization_id).maybeSingle();

    const businessName = businessSettings?.business_name || emailConfig.fromName;
    const businessReplyTo = businessSettings?.business_email;
    const businessPhone = businessSettings?.business_phone || "";
    const businessEmailAddr = businessSettings?.business_email || "";
    const businessAddress = businessSettings?.business_address || "";
    const logoUrl = businessSettings?.logo_url || undefined;
    const normalizedClientEmail = clientEmail.toLowerCase();
    const unsubscribeUrl = `https://bizzypro.app/unsubscribe?org=${encodeURIComponent(invoice.organization_id)}&email=${encodeURIComponent(normalizedClientEmail)}`;

    // Generate a per-invoice Stripe Checkout session when Stripe is configured
    // and a checkout URL wasn't already provided. This replaces the static payment
    // link so the webhook can match the payment back to this specific invoice.
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    let resolvedStripeUrl: string | undefined = checkoutUrl || undefined;
    if (!resolvedStripeUrl && stripeSecretKey && invoice.payment_status !== "paid") {
      const generatedUrl = await createStripeCheckoutForInvoice(
        invoice,
        businessName,
        stripeSecretKey,
        supabase,
      );
      resolvedStripeUrl = generatedUrl || businessSettings?.stripe_payment_link || undefined;
    } else if (!resolvedStripeUrl) {
      resolvedStripeUrl = businessSettings?.stripe_payment_link || undefined;
    }

    const paymentMethods: PaymentMethods = {
      stripePaymentLink: resolvedStripeUrl,
      venmoUsername: businessSettings?.venmo_username || undefined,
      cashappUsername: businessSettings?.cashapp_username || undefined,
      zelleEmail: businessSettings?.zelle_email || undefined,
      zellePhone: businessSettings?.zelle_phone || undefined,
      checkPayableTo: businessSettings?.check_payable_to || undefined,
      checkMailingAddress: businessSettings?.check_mailing_address || undefined,
    };

    const resolvedGoogleReviewUrl = payloadGoogleReviewUrl ||
      (businessSettings?.include_google_review_on_invoice ? businessSettings?.google_review_url : null) ||
      undefined;

    const { data: emailTemplate } = await supabase.from("message_templates").select("email_subject, email_body")
      .eq("organization_id", invoice.organization_id).eq("template_type", "invoice_email").eq("is_active", true).maybeSingle();

    const invoiceItems = invoice.invoice_items || [];
    const isPastDue = new Date(invoice.due_date) < new Date() && invoice.payment_status !== "paid";
    const statusText = invoice.payment_status === "paid" ? "PAID" : isPastDue ? "PAST DUE" : "PENDING";

    let customMessage = "";
    const invoiceMemoOrNum = invoice.memo ? invoice.memo : `#${invoice.invoice_number}`;
    let customSubject = `Invoice ${invoiceMemoOrNum} from ${businessName}${isPastDue ? " - Past Due" : ""}`;

    if (emailTemplate) {
      const placeholders: Record<string, string> = {
        "{business_name}": businessName, "{client_name}": clientName,
        "{invoice_number}": invoice.invoice_number, "{total}": Number(invoice.total).toFixed(2),
        "{due_date}": new Date(invoice.due_date).toLocaleDateString(),
        "{issue_date}": new Date(invoice.issue_date).toLocaleDateString(),
        "{status}": statusText, "{subtotal}": Number(invoice.subtotal).toFixed(2),
        "{tax_amount}": Number(invoice.tax_amount).toFixed(2),
      };
      if (emailTemplate.email_body) {
        customMessage = emailTemplate.email_body;
        Object.entries(placeholders).forEach(([k, v]) => { customMessage = customMessage.replace(new RegExp(k.replace(/[{}]/g, "\\$&"), "g"), v); });
      }
      if (emailTemplate.email_subject) {
        customSubject = emailTemplate.email_subject;
        Object.entries(placeholders).forEach(([k, v]) => { customSubject = customSubject.replace(new RegExp(k.replace(/[{}]/g, "\\$&"), "g"), v); });
        if (isPastDue && !customSubject.includes("Past Due")) customSubject += " - Past Due";
      }
    }

    const emailHtml = buildInvoiceEmailHtml(invoice, invoiceItems, businessName, businessPhone, businessEmailAddr, businessAddress, clientName, customMessage, unsubscribeUrl, paymentMethods, logoUrl, resolvedGoogleReviewUrl, businessSettings?.show_cc_fee_notice ?? false, businessSettings?.cc_processing_fee_percent ?? 0, invoice.pdf_url || undefined);

    const ccFeeAmount = Number(invoice.cc_fee_amount) || 0;
    const totalWithFee = Number(invoice.total);
    const totalWithoutFee = ccFeeAmount > 0 ? totalWithFee - ccFeeAmount : totalWithFee;
    const invoiceRef = invoice.memo ? invoice.memo : `#${invoice.invoice_number}`;
    const dueDateStr = new Date(invoice.due_date).toLocaleDateString();

    const payLines: string[] = [];
    if (paymentMethods.venmoUsername) {
      const handle = paymentMethods.venmoUsername.replace(/^@/, "");
      const noteRef = encodeURIComponent(`Invoice ${invoiceRef}`);
      payLines.push(`Venmo: https://venmo.com/${handle}?txn=pay&amount=${totalWithoutFee.toFixed(2)}&note=${noteRef}`);
    }
    if (paymentMethods.cashappUsername) {
      const tag = paymentMethods.cashappUsername.replace(/^\$/, "");
      payLines.push(`Cash App: https://cash.app/${tag}/${totalWithoutFee.toFixed(2)}`);
    }
    if (paymentMethods.zelleEmail || paymentMethods.zellePhone) {
      payLines.push(`Zelle: ${paymentMethods.zelleEmail || paymentMethods.zellePhone}`);
    }
    if (paymentMethods.checkPayableTo) {
      const checkInfo = paymentMethods.checkMailingAddress
        ? `${paymentMethods.checkPayableTo}, ${paymentMethods.checkMailingAddress}`
        : paymentMethods.checkPayableTo;
      payLines.push(`Check: ${checkInfo}`);
    }
    if (paymentMethods.stripePaymentLink) {
      const cardTotal = ccFeeAmount > 0 ? totalWithFee.toFixed(2) : totalWithoutFee.toFixed(2);
      payLines.push(`Card (${cardTotal}): ${paymentMethods.stripePaymentLink}`);
    }
    if (invoice.pdf_url) {
      payLines.push(`PDF: ${invoice.pdf_url}`);
    }

    const simplifiedText = `Hi ${clientName}, your invoice ${invoiceRef} for ${totalWithoutFee.toFixed(2)} is ready. Due: ${dueDateStr}.${payLines.length > 0 ? "\n" + payLines.join("\n") : ""}`;
    const emailText = simplifiedText;

    const ccList: string[] = [];
    if (sendToSelf && businessReplyTo && businessReplyTo.toLowerCase() !== normalizedClientEmail) {
      ccList.push(businessReplyTo.toLowerCase());
    }

    const mgPayload: Record<string, string> = {
      from: `${businessName} <${emailConfig.fromEmail}>`,
      to: normalizedClientEmail,
      subject: customSubject,
      html: emailHtml,
      text: emailText,
      "h:List-Unsubscribe": `<${unsubscribeUrl}>`,
      "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
    if (businessReplyTo) mgPayload["h:Reply-To"] = businessReplyTo.toLowerCase();
    if (ccList.length > 0) mgPayload.cc = ccList.join(",");

    const pdfAttachment = pdfBase64
      ? { base64: pdfBase64, filename: `Invoice-${invoice.invoice_number}.pdf` }
      : undefined;

    const { response: emailResponse, usedFallback } = await sendEmailWithRetry(
      { apiKey: emailConfig.apiKey!, fallbackApiKey: emailConfig.fallbackApiKey, sendingDomain: emailConfig.sendingDomain, settingsId: emailConfig.settingsId },
      mgPayload, supabase, pdfAttachment,
    );

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`Mailgun error (${emailResponse.status}):`, errorText);
      const userError = emailResponse.status === 401
        ? "Email service authorization failed. The Mailgun API key may be invalid or expired -- please check your email settings or contact support."
        : `Email failed (${emailResponse.status}). Please check your email domain configuration in Settings.`;
      return new Response(JSON.stringify({ success: false, error: userError, details: errorText }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (usedFallback) console.log("Email sent using fallback API key");

    const emailResult = await emailResponse.json();
    await supabase.from("invoices").update({ status: "sent", sent_via: "email", sent_at: new Date().toISOString() }).eq("id", invoiceId);

    return new Response(JSON.stringify({ success: true, message: "Email sent successfully", emailId: emailResult.id, hasPdf: !!pdfBase64 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
