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

async function getEmailConfig(supabase: any, organizationId: string) {
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
          };
        }
      }
    } catch (e) {
      console.error("Custom domain key decryption failed:", e);
    }
  }

  const masterKey = envKey || settings?.mailgun_master_api_key;
  if (!masterKey) return null;

  return {
    apiKey: masterKey,
    fallbackApiKey: null,
    fromName: settings?.custom_from_name || "Your Business",
    fromEmail: DEFAULT_FROM_EMAIL,
    sendingDomain: DEFAULT_DOMAIN,
  };
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

function buildReceiptHtml(
  invoice: any,
  items: any[],
  businessName: string,
  businessPhone: string,
  businessEmail: string,
  businessAddress: string,
  clientName: string,
  amountPaid: number,
  paidDate: string,
  unsubscribeUrl: string,
  googleReviewUrl: string | null,
  logoUrl?: string,
): string {
  const paidDateFormatted = new Date(paidDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const itemRows = items.map((item: any) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">${esc(item.description)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:14px;color:#1e293b;">${item.quantity}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:#1e293b;">${fmt(item.unit_price)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(item.total)}</td>
    </tr>`).join("");

  const taxRow = Number(invoice.tax_rate) > 0
    ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Tax (${invoice.tax_rate}%)</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(invoice.tax_amount)}</td></tr>` : "";
  const ccFeeRow = Number(invoice.cc_fee_amount) > 0
    ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">CC Processing Fee (${invoice.cc_fee_percent ?? 0}%)</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">${fmt(invoice.cc_fee_amount)}</td></tr>` : "";

  const googleReviewSection = googleReviewUrl ? `
    <div style="margin-bottom:24px;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center;">
      <div style="font-size:22px;margin-bottom:8px;">&#11088;</div>
      <div style="font-size:15px;font-weight:700;color:#166534;margin-bottom:6px;">Enjoying our service?</div>
      <div style="font-size:13px;color:#15803d;margin-bottom:14px;line-height:1.5;">We'd love to hear from you! Your review helps us grow and helps others find us.</div>
      <a href="${esc(googleReviewUrl)}" target="_blank" style="display:inline-block;padding:10px 24px;background:#059669;color:#ffffff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;">Leave a Google Review</a>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Receipt - Invoice #${esc(invoice.invoice_number)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr><td style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
        <tr><td style="background:${ACCENT};padding:36px 32px;border-radius:12px 12px 0 0;text-align:center;">
          ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" style="max-width:160px;max-height:60px;margin-bottom:12px;" />` : ""}
          <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px;">${esc(businessName)}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px;">Payment Receipt</div>
          <div style="display:inline-block;margin-top:12px;padding:5px 18px;border-radius:20px;background:#059669;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;">PAID</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:32px;">
          <p style="font-size:15px;color:#1e293b;margin:0 0 8px;">Hello ${esc(clientName)},</p>
          <p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.6;">Thank you for your payment! Here is your receipt for Invoice #${esc(invoice.invoice_number)}.</p>

          <div style="margin-bottom:24px;padding:16px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:4px 0;"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Amount Paid</div><div style="font-size:22px;font-weight:800;color:#059669;margin-top:3px;">${fmt(amountPaid)}</div></td>
                <td style="padding:4px 0;text-align:right;"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Date Paid</div><div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:3px;">${paidDateFormatted}</div></td>
              </tr>
            </table>
          </div>

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
            ${taxRow}${ccFeeRow}
            <tr><td colspan="2" style="padding:0;"><div style="border-top:3px solid ${ACCENT};margin:10px 0;"></div></td></tr>
            <tr><td style="padding:6px 0;font-size:20px;font-weight:800;color:#1e293b;">Total Paid</td><td style="padding:6px 0 6px 32px;text-align:right;font-size:20px;font-weight:800;color:#059669;">${fmt(amountPaid)}</td></tr>
          </table>

          ${googleReviewSection}

          <p style="font-size:14px;color:#64748b;margin:0 0 4px;">Thank you for your business!</p>
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== serviceRoleKey) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(JSON.stringify({ success: false, error: "Invalid or expired authentication token" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { invoiceId, clientEmail, clientName, amountPaid, paidDate, googleReviewUrl } = await req.json();

    if (!invoiceId || !clientEmail) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields: invoiceId, clientEmail" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ success: false, error: "Failed to fetch invoice" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = clientEmail.toLowerCase().trim();
    const { data: unsubRecord } = await supabase
      .from("email_unsubscribes")
      .select("id")
      .eq("organization_id", invoice.organization_id)
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (unsubRecord) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: "unsubscribed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailConfig = await getEmailConfig(supabase, invoice.organization_id);
    if (!emailConfig) {
      return new Response(JSON.stringify({ success: false, error: "Email service not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: businessSettings } = await supabase
      .from("business_settings")
      .select("business_name, business_email, business_phone, business_address, logo_url")
      .eq("organization_id", invoice.organization_id)
      .maybeSingle();

    const businessName = businessSettings?.business_name || emailConfig.fromName;
    const businessPhone = businessSettings?.business_phone || "";
    const businessEmailAddr = businessSettings?.business_email || "";
    const businessAddress = businessSettings?.business_address || "";
    const logoUrl = businessSettings?.logo_url || undefined;
    const unsubscribeUrl = `https://bizzypro.app/unsubscribe?org=${encodeURIComponent(invoice.organization_id)}&email=${encodeURIComponent(normalizedEmail)}`;

    const resolvedAmountPaid = amountPaid ?? Number(invoice.total);
    const resolvedPaidDate = paidDate ?? new Date().toISOString();
    const invoiceItems = invoice.invoice_items || [];

    const emailHtml = buildReceiptHtml(
      invoice, invoiceItems, businessName, businessPhone, businessEmailAddr, businessAddress,
      clientName || "Valued Customer", resolvedAmountPaid, resolvedPaidDate,
      unsubscribeUrl, googleReviewUrl || null, logoUrl,
    );
    const emailText = stripHtml(emailHtml);

    const form = new FormData();
    form.append("from", `${businessName} <${emailConfig.fromEmail}>`);
    form.append("to", normalizedEmail);
    form.append("subject", `Payment Receipt - Invoice #${invoice.invoice_number} from ${businessName}`);
    form.append("html", emailHtml);
    form.append("text", emailText);
    form.append("h:List-Unsubscribe", `<${unsubscribeUrl}>`);
    form.append("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
    if (businessEmailAddr) form.append("h:Reply-To", businessEmailAddr);

    const mgResponse = await fetch(`https://api.mailgun.net/v3/${emailConfig.sendingDomain}/messages`, {
      method: "POST",
      headers: { "Authorization": `Basic ${btoa(`api:${emailConfig.apiKey}`)}` },
      body: form,
    });

    if (!mgResponse.ok) {
      const errorText = await mgResponse.text();
      console.error(`Mailgun error (${mgResponse.status}):`, errorText);
      return new Response(JSON.stringify({ success: false, error: `Email failed (${mgResponse.status})` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Receipt sent successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending receipt:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
