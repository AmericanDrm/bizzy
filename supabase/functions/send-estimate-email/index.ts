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

interface EmailPayload {
  estimateId: string;
  clientEmail: string;
  clientName: string;
  sendToSelf?: boolean;
  pdfBase64?: string;
  pdfUrl?: string;
  photoUrls?: string[];
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

function generateToken(length = 48): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

function esc(s: string): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n").replace(/<\/td>/gi, "  ").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, "-")
    .replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function getScopeLabel(scope: string): string {
  if (scope === 'full_service') return 'Full Service';
  if (scope === 'exterior_only') return 'Exterior Only';
  if (scope === 'interior_only') return 'Interior Only';
  return scope;
}

function buildEstimateEmailHtml(
  estimate: any, items: any[], businessName: string, businessPhone: string,
  businessEmail: string, businessAddress: string, clientName: string,
  approvalUrl: string, customMessage: string, unsubscribeUrl: string,
  logoUrl?: string, photoSection?: string, pdfUrl?: string,
): string {
  const sorted = [...items].sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

  const itemRows = sorted.map((item: any) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">
        ${esc(item.description)}${item.is_optional ? ' <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;text-transform:uppercase;">Optional</span>' : ''}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:14px;color:#1e293b;">${item.quantity}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:#1e293b;">${fmt(item.unit_price)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(item.total)}</td>
    </tr>`).join("");

  const scopeMap: Record<string, number> = {};
  for (const item of sorted) {
    const s = item.service_scope || 'full_service';
    scopeMap[s] = (scopeMap[s] || 0) + Number(item.total);
  }
  const activeScopes = Object.keys(scopeMap);
  const hasMultipleScopes = activeScopes.length > 1;

  const taxRateNum = Number(estimate.tax_rate) / 100;
  const itemsTotal = sorted.reduce((sum: number, i: any) => sum + Number(i.total), 0);
  const discountRatio = itemsTotal > 0 ? (Number(estimate.subtotal) / itemsTotal) : 1;

  const discAmt = Number(estimate.discount_amount) || 0;
  const discPct = Number(estimate.discount_percentage) || 0;
  let discountRow = "";
  if (!hasMultipleScopes) {
    if (discAmt > 0) {
      discountRow = `<tr><td style="padding:6px 0;font-size:14px;color:#16a34a;">Discount</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#16a34a;">-${fmt(discAmt)}</td></tr>`;
    } else if (discPct > 0) {
      const da = (Number(estimate.subtotal) * discPct) / 100;
      discountRow = `<tr><td style="padding:6px 0;font-size:14px;color:#16a34a;">Discount (${discPct}%)</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#16a34a;">-${fmt(da)}</td></tr>`;
    }
  }

  let scopeTotalsRows = "";
  let subtotalRow = "";
  let taxRow = "";
  if (hasMultipleScopes) {
    scopeTotalsRows = activeScopes.map(scope => {
      const scopeSubtotal = scopeMap[scope] * discountRatio;
      const scopeTotal = scopeSubtotal * (1 + taxRateNum);
      return `<tr><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:700;">${esc(getScopeLabel(scope))} Total (incl. tax)</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:800;color:${ACCENT};">${fmt(scopeTotal)}</td></tr>`;
    }).join("");
  } else {
    subtotalRow = `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Subtotal</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(estimate.subtotal)}</td></tr>`;
    taxRow = Number(estimate.tax_rate) > 0
      ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Tax (${estimate.tax_rate}%)</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(estimate.tax_amount)}</td></tr>` : "";
  }

  const validDate = new Date(estimate.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const issueDate = new Date(estimate.issue_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const pdfButton = pdfUrl
    ? `<div style="text-align:center;margin-bottom:16px;"><a href="${esc(pdfUrl)}" style="display:inline-block;background:#ffffff;color:${ACCENT};text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;border:2px solid ${ACCENT};">Download PDF</a></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estimate #${esc(estimate.estimate_number)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr><td style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
        <tr><td style="background:${ACCENT};padding:36px 32px;border-radius:12px 12px 0 0;text-align:center;">
          ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" style="max-width:160px;max-height:60px;margin-bottom:12px;" />` : ""}
          <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px;">${esc(businessName)}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px;">Estimate ${estimate.memo ? esc(estimate.memo) : '#' + esc(estimate.estimate_number)}</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:32px;">
          ${customMessage
            ? `<div style="margin-bottom:24px;padding:16px 20px;background:#f8fafc;border-radius:8px;font-size:14px;color:#1e293b;line-height:1.6;">${customMessage}</div>`
            : `<p style="font-size:15px;color:#1e293b;margin:0 0 8px;">Hello ${esc(clientName)},</p><p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.6;">Thank you for your interest! Please find your estimate below. You can review and approve it directly by clicking the button below.</p>`
          }
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f8fafc;border-radius:8px;">
            <tr>
              <td style="padding:14px 20px;"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Issue Date</div><div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:3px;">${issueDate}</div></td>
              <td style="padding:14px 20px;"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Valid Until</div><div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:3px;">${validDate}</div></td>
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
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-left:auto;margin-bottom:28px;min-width:260px;">
            ${hasMultipleScopes ? scopeTotalsRows : `${subtotalRow}${discountRow}${taxRow}<tr><td colspan="2" style="padding:0;"><div style="border-top:3px solid ${ACCENT};margin:10px 0;"></div></td></tr><tr><td style="padding:6px 0;font-size:20px;font-weight:800;color:#1e293b;">Total</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:20px;font-weight:800;color:${ACCENT};">${fmt(estimate.total)}</td></tr>`}
          </table>
          <div style="text-align:center;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;font-weight:600;margin-bottom:28px;">This estimate is valid until ${validDate}</div>
          <div style="text-align:center;padding:8px 0 16px;">
            <a href="${approvalUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:18px 56px;border-radius:10px;font-size:17px;font-weight:700;letter-spacing:0.3px;">Approve &amp; Sign</a>
            <p style="font-size:12px;color:#94a3b8;margin-top:14px;">Click above to review, select optional services, and approve with your signature.</p>
          </div>
          ${pdfButton}
          ${estimate.notes ? `<div style="margin-bottom:24px;padding:16px 20px;background:#f8fafc;border-left:4px solid ${ACCENT};border-radius:0 8px 8px 0;"><div style="font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Notes</div><div style="font-size:13px;color:#64748b;line-height:1.6;">${esc(estimate.notes)}</div></div>` : ""}
          ${!customMessage ? `<p style="font-size:14px;color:#64748b;margin:0 0 4px;">If you have any questions, don't hesitate to reach out.</p><p style="font-size:14px;color:#1e293b;margin:0;">Best regards,<br/><strong>${esc(businessName)}</strong></p>` : ""}
        </td></tr>
        ${photoSection || ""}
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
    const { estimateId, clientEmail, clientName, sendToSelf, pdfBase64, pdfUrl, photoUrls } = payload;

    if (!estimateId || !clientEmail) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields: estimateId, clientEmail" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: estimate, error: estimateError } = await supabase.from("estimates").select("*, estimate_items(*)").eq("id", estimateId).single();
    if (estimateError || !estimate) {
      return new Response(JSON.stringify({ success: false, error: "Failed to fetch estimate" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalizedEmail = clientEmail.toLowerCase().trim();
    const { data: unsubRecord } = await supabase.from("email_unsubscribes").select("id").eq("organization_id", estimate.organization_id).ilike("email", normalizedEmail).maybeSingle();
    if (unsubRecord) {
      return new Response(JSON.stringify({ success: false, error: "This client has unsubscribed from your emails. They will need to re-subscribe before you can send to them.", unsubscribed: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailConfig = await getEmailConfig(supabase, estimate.organization_id);
    if (!emailConfig.apiKey) {
      return new Response(JSON.stringify({ success: false, error: emailConfig.error, needsSetup: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: businessSettings } = await supabase.from("business_settings")
      .select("business_name, business_email, business_phone, business_address, logo_url")
      .eq("organization_id", estimate.organization_id).maybeSingle();

    const businessName = businessSettings?.business_name || emailConfig.fromName;
    const businessReplyTo = businessSettings?.business_email?.toLowerCase() || emailConfig.fromEmail;
    const businessPhone = businessSettings?.business_phone || "";
    const businessEmail = businessSettings?.business_email || "";
    const businessAddress = businessSettings?.business_address || "";
    const logoUrl = businessSettings?.logo_url || undefined;
    const normalizedClientEmail = clientEmail.toLowerCase();

    const { data: emailTemplate } = await supabase.from("message_templates").select("email_subject, email_body")
      .eq("organization_id", estimate.organization_id).eq("template_type", "estimate_email").eq("is_active", true).maybeSingle();

    const token = generateToken();
    const expiresAt = new Date(estimate.valid_until);
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase.from("estimate_approval_tokens").insert({
      estimate_id: estimateId,
      token,
      expires_at: expiresAt.toISOString(),
    });

    const approvalUrl = `https://bizzypro.app/approve/${token}`;
    const unsubscribeUrl = `https://bizzypro.app/unsubscribe?org=${encodeURIComponent(estimate.organization_id)}&email=${encodeURIComponent(normalizedClientEmail)}`;

    let customMessage = "";
    const estimateMemoOrNum = estimate.memo ? estimate.memo : `#${estimate.estimate_number}`;
    let customSubject = `Estimate ${estimateMemoOrNum} from ${businessName}`;

    if (emailTemplate) {
      const placeholders: Record<string, string> = {
        "{business_name}": businessName, "{client_name}": clientName,
        "{estimate_number}": estimate.estimate_number, "{total}": Number(estimate.total).toFixed(2),
        "{valid_until}": new Date(estimate.valid_until).toLocaleDateString(),
        "{subtotal}": Number(estimate.subtotal).toFixed(2),
        "{tax_amount}": Number(estimate.tax_amount).toFixed(2),
      };
      if (emailTemplate.email_body) {
        customMessage = emailTemplate.email_body;
        Object.entries(placeholders).forEach(([k, v]) => { customMessage = customMessage.replace(new RegExp(k.replace(/[{}]/g, "\\$&"), "g"), v); });
      }
      if (emailTemplate.email_subject) {
        customSubject = emailTemplate.email_subject;
        Object.entries(placeholders).forEach(([k, v]) => { customSubject = customSubject.replace(new RegExp(k.replace(/[{}]/g, "\\$&"), "g"), v); });
      }
    }

    let photoSection = "";
    if (photoUrls && photoUrls.length > 0) {
      const photoImgs = photoUrls.map((url) =>
        `<td style="padding:4px;"><img src="${esc(url)}" alt="Photo" style="width:180px;height:135px;object-fit:cover;border-radius:8px;display:block;" /></td>`
      ).join("");
      photoSection = `<tr><td style="padding:0 32px 24px;"><div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Attached Photos</div><table role="presentation" cellpadding="0" cellspacing="0"><tr>${photoImgs}</tr></table></td></tr>`;
    }

    const resolvedPdfUrl = pdfUrl || estimate.pdf_url || undefined;
    const emailHtml = buildEstimateEmailHtml(estimate, estimate.estimate_items || [], businessName, businessPhone, businessEmail, businessAddress, clientName, approvalUrl, customMessage, unsubscribeUrl, logoUrl, photoSection, resolvedPdfUrl);
    const emailText = stripHtml(emailHtml);

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
      "h:Reply-To": businessReplyTo,
      "h:List-Unsubscribe": `<${unsubscribeUrl}>`,
      "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
    if (ccList.length > 0) mgPayload.cc = ccList.join(",");

    const pdfAttachment = pdfBase64
      ? { base64: pdfBase64, filename: `Estimate-${estimate.estimate_number}.pdf` }
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
        : `Email delivery failed (${emailResponse.status}). Please check your email domain configuration in Settings.`;
      return new Response(JSON.stringify({ success: false, error: userError, details: errorText }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (usedFallback) console.log("Email sent using fallback API key");

    const emailResult = await emailResponse.json();
    await supabase.from("estimates").update({ status: "sent", sent_via: "email", sent_at: new Date().toISOString() }).eq("id", estimateId);

    return new Response(JSON.stringify({ success: true, message: "Email sent successfully", emailId: emailResult.id, hasPdf: !!pdfBase64 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
