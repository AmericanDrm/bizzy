import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_FROM_EMAIL = "notifications@bizzypro.app";
const DEFAULT_DOMAIN = "bizzypro.app";
const ACCENT = "#1a3c5e";

interface StatementPayload {
  clientEmail: string;
  clientName: string;
  organizationId: string;
  invoiceIds: string[];
  sortMode?: "oldest_first" | "newest_first" | "past_due_first";
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

async function sendWithMailgun(
  apiKey: string,
  sendingDomain: string,
  payload: Record<string, string>,
): Promise<Response> {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
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
): Promise<{ response: Response; usedFallback: boolean }> {
  const MAX_RETRIES = 2;
  const RETRY_DELAYS = [1000, 2000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await sendWithMailgun(emailConfig.apiKey, emailConfig.sendingDomain, mgPayload);
    if (response.ok) return { response, usedFallback: false };

    if (response.status === 401 && emailConfig.fallbackApiKey) {
      const fallbackResponse = await sendWithMailgun(emailConfig.fallbackApiKey, emailConfig.sendingDomain, mgPayload);
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

  return { response: await sendWithMailgun(emailConfig.apiKey, emailConfig.sendingDomain, mgPayload), usedFallback: false };
}

function esc(s: string): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function sortInvoices(invoices: any[], mode: string): any[] {
  const sorted = [...invoices];
  const today = new Date().toISOString().split("T")[0];

  switch (mode) {
    case "oldest_first":
      return sorted.sort((a, b) => a.due_date.localeCompare(b.due_date));
    case "newest_first":
      return sorted.sort((a, b) => b.due_date.localeCompare(a.due_date));
    case "past_due_first": {
      const pastDue = sorted.filter(i => i.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
      const current = sorted.filter(i => i.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date));
      return [...pastDue, ...current];
    }
    default:
      return sorted;
  }
}

function buildStatementEmailHtml(
  invoices: any[],
  clientName: string,
  businessName: string,
  businessPhone: string,
  businessEmail: string,
  businessAddress: string,
  unsubscribeUrl: string,
  logoUrl?: string,
  paymentMethodsHtml?: string,
): string {
  const today = new Date().toISOString().split("T")[0];
  let totalDue = 0;

  const invoiceRows = invoices.map((inv: any) => {
    const amountDue = Math.max(0, Number(inv.total) - (Number(inv.amount_paid) || 0));
    totalDue += amountDue;
    const overdue = inv.due_date < today;
    const label = inv.memo ? esc(inv.memo) : `#${esc(inv.invoice_number)}`;
    const rowBg = overdue ? "#fef2f2" : "#ffffff";
    const dueDateColor = overdue ? "#dc2626" : "#1e293b";
    const overdueTag = overdue
      ? `<span style="display:inline-block;padding:2px 8px;background:#fecaca;color:#dc2626;font-size:10px;font-weight:700;border-radius:4px;margin-left:8px;text-transform:uppercase;letter-spacing:0.5px;">Past Due</span>`
      : "";

    return `<tr style="background:${rowBg};">
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;font-weight:500;">${label}${overdueTag}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(amountDue)}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:${dueDateColor};font-weight:500;">${formatDate(inv.due_date)}</td>
    </tr>`;
  }).join("");

  const hasPastDue = invoices.some((inv: any) => inv.due_date < today);
  const statementDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account Statement</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr><td style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
        <tr><td style="background:${ACCENT};padding:36px 32px;border-radius:12px 12px 0 0;text-align:center;">
          ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" style="max-width:160px;max-height:60px;margin-bottom:12px;" />` : ""}
          <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px;">${esc(businessName)}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px;">Account Statement</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:32px;">
          <p style="font-size:15px;color:#1e293b;margin:0 0 8px;">Hello ${esc(clientName)},</p>
          <p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.6;">Below is a summary of your outstanding invoices as of ${statementDate}.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f8fafc;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:16px 20px;text-align:center;">
                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Invoices</div>
                <div style="font-size:22px;font-weight:800;color:#1e293b;margin-top:4px;">${invoices.length}</div>
              </td>
              <td style="padding:16px 20px;text-align:center;border-left:1px solid #e2e8f0;">
                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Total Due</div>
                <div style="font-size:22px;font-weight:800;color:${ACCENT};margin-top:4px;">${fmt(totalDue)}</div>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <thead>
              <tr>
                <th style="background:${ACCENT};color:#fff;padding:12px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:left;border-radius:4px 0 0 0;">Invoice</th>
                <th style="background:${ACCENT};color:#fff;padding:12px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:right;">Amount Due</th>
                <th style="background:${ACCENT};color:#fff;padding:12px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;text-align:right;border-radius:0 4px 0 0;">Due Date</th>
              </tr>
            </thead>
            <tbody>${invoiceRows}</tbody>
            <tfoot>
              <tr>
                <td style="padding:14px 16px;font-size:16px;font-weight:800;color:#1e293b;border-top:3px solid ${ACCENT};">Total Outstanding</td>
                <td colspan="2" style="padding:14px 16px;text-align:right;font-size:18px;font-weight:800;color:${ACCENT};border-top:3px solid ${ACCENT};">${fmt(totalDue)}</td>
              </tr>
            </tfoot>
          </table>

          ${hasPastDue ? `<div style="text-align:center;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:14px;color:#dc2626;font-weight:600;margin-bottom:24px;">One or more invoices are past due. Please submit payment as soon as possible.</div>` : ""}

          ${paymentMethodsHtml || ""}

          <p style="font-size:14px;color:#64748b;margin:0 0 4px;">If you have any questions about your account, please don't hesitate to reach out.</p>
          <p style="font-size:14px;color:#1e293b;margin:0;">Best regards,<br/><strong>${esc(businessName)}</strong></p>
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

function buildPaymentMethodsSection(businessSettings: any): string {
  const methods: string[] = [];
  const methodStyle = `display:inline-block;padding:12px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;width:100%;box-sizing:border-box;`;
  const labelStyle = `font-size:14px;font-weight:700;color:#1e293b;`;
  const detailStyle = `font-size:13px;color:#64748b;margin-top:4px;line-height:1.5;`;

  if (businessSettings.stripe_payment_link) {
    methods.push(`<tr><td style="padding:0 0 12px 0;">
      <a href="${esc(businessSettings.stripe_payment_link)}" target="_blank" style="display:block;padding:14px 20px;background:${ACCENT};border-radius:8px;text-decoration:none;text-align:center;">
        <div style="font-size:14px;font-weight:700;color:#ffffff;">Pay Online by Card</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">Secure payment via Stripe</div>
      </a>
    </td></tr>`);
  }

  if (businessSettings.venmo_username) {
    const handle = businessSettings.venmo_username.replace(/^@/, "");
    methods.push(`<tr><td style="padding:0 0 12px 0;"><div style="${methodStyle}"><div style="${labelStyle}">Venmo</div><div style="${detailStyle}">Send to @${esc(handle)}</div></div></td></tr>`);
  }

  if (businessSettings.cashapp_username) {
    const tag = businessSettings.cashapp_username.replace(/^\$/, "");
    methods.push(`<tr><td style="padding:0 0 12px 0;"><div style="${methodStyle}"><div style="${labelStyle}">Cash App</div><div style="${detailStyle}">Send to $${esc(tag)}</div></div></td></tr>`);
  }

  if (businessSettings.zelle_email || businessSettings.zelle_phone) {
    const target = businessSettings.zelle_email || businessSettings.zelle_phone;
    methods.push(`<tr><td style="padding:0 0 12px 0;"><div style="${methodStyle}"><div style="${labelStyle}">Zelle</div><div style="${detailStyle}">Send to: ${esc(target)}</div></div></td></tr>`);
  }

  if (businessSettings.check_payable_to) {
    const details = [`Make payable to: ${esc(businessSettings.check_payable_to)}`];
    if (businessSettings.check_mailing_address) details.push(`Mail to: ${esc(businessSettings.check_mailing_address)}`);
    methods.push(`<tr><td style="padding:0 0 12px 0;"><div style="${methodStyle}"><div style="${labelStyle}">Check</div><div style="${detailStyle}">${details.join("<br/>")}</div></div></td></tr>`);
  }

  if (methods.length === 0) return "";

  return `<div style="margin-bottom:24px;">
    <div style="font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid ${ACCENT};">How to Pay</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${methods.join("")}
    </table>
  </div>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n").replace(/<\/td>/gi, "  ").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, "-")
    .replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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

    const payload: StatementPayload = await req.json();
    const { clientEmail, clientName, organizationId, invoiceIds, sortMode } = payload;

    if (!clientEmail || !organizationId || !invoiceIds?.length) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields: clientEmail, organizationId, invoiceIds" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalizedEmail = clientEmail.toLowerCase().trim();

    const { data: unsubRecord } = await supabase.from("email_unsubscribes").select("id").eq("organization_id", organizationId).ilike("email", normalizedEmail).maybeSingle();
    if (unsubRecord) {
      return new Response(JSON.stringify({ success: false, error: "This client has unsubscribed from your emails.", unsubscribed: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailConfig = await getEmailConfig(supabase, organizationId);
    if (!emailConfig.apiKey) {
      return new Response(JSON.stringify({ success: false, error: emailConfig.error, needsSetup: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("id, invoice_number, memo, total, amount_paid, due_date, payment_status, issue_date")
      .in("id", invoiceIds)
      .eq("organization_id", organizationId);

    if (invError || !invoices?.length) {
      return new Response(JSON.stringify({ success: false, error: "Failed to fetch invoices" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sortedInvoices = sortInvoices(invoices, sortMode || "past_due_first");

    const { data: businessSettings } = await supabase.from("business_settings")
      .select("business_name, business_email, business_phone, business_address, logo_url, stripe_payment_link, venmo_username, cashapp_username, zelle_email, zelle_phone, check_payable_to, check_mailing_address")
      .eq("organization_id", organizationId).maybeSingle();

    const businessName = businessSettings?.business_name || emailConfig.fromName;
    const businessReplyTo = businessSettings?.business_email;
    const businessPhone = businessSettings?.business_phone || "";
    const businessEmailAddr = businessSettings?.business_email || "";
    const businessAddress = businessSettings?.business_address || "";
    const logoUrl = businessSettings?.logo_url || undefined;
    const unsubscribeUrl = `https://bizzypro.app/unsubscribe?org=${encodeURIComponent(organizationId)}&email=${encodeURIComponent(normalizedEmail)}`;

    const paymentMethodsHtml = businessSettings ? buildPaymentMethodsSection(businessSettings) : "";

    const emailHtml = buildStatementEmailHtml(
      sortedInvoices, clientName, businessName, businessPhone,
      businessEmailAddr, businessAddress, unsubscribeUrl, logoUrl, paymentMethodsHtml,
    );
    const emailText = stripHtml(emailHtml);

    const hasPastDue = sortedInvoices.some((inv: any) => inv.due_date < new Date().toISOString().split("T")[0]);
    const subject = `Account Statement from ${businessName}${hasPastDue ? " - Action Required" : ""}`;

    const mgPayload: Record<string, string> = {
      from: `${businessName} <${emailConfig.fromEmail}>`,
      to: normalizedEmail,
      subject,
      html: emailHtml,
      text: emailText,
      "h:List-Unsubscribe": `<${unsubscribeUrl}>`,
      "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
    if (businessReplyTo) mgPayload["h:Reply-To"] = businessReplyTo.toLowerCase();

    const { response: emailResponse } = await sendEmailWithRetry(
      { apiKey: emailConfig.apiKey!, fallbackApiKey: emailConfig.fallbackApiKey, sendingDomain: emailConfig.sendingDomain, settingsId: emailConfig.settingsId },
      mgPayload, supabase,
    );

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`Mailgun error (${emailResponse.status}):`, errorText);
      const userError = emailResponse.status === 401
        ? "Email service authorization failed. Please check your email settings."
        : `Email failed (${emailResponse.status}). Please check your email configuration.`;
      return new Response(JSON.stringify({ success: false, error: userError }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailResult = await emailResponse.json();
    return new Response(JSON.stringify({ success: true, message: "Statement sent successfully", emailId: emailResult.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
