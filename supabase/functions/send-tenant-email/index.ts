import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_FROM_EMAIL = "notifications@bizzypro.app";
const DEFAULT_FROM_NAME = "Bizzy";
const DEFAULT_DOMAIN = "bizzypro.app";

interface EmailRequest {
  organizationId: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
  unsubscribeUrl?: string;
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
            fromName: settings.custom_from_name || DEFAULT_FROM_NAME,
            fromEmail: (settings.custom_from_email || `noreply@${domain}`).toLowerCase(),
            sendingDomain: domain,
            settingsId: settings.id,
          };
        }
      }
    } catch (e) {
      console.error("Custom domain key decryption failed, falling back to default:", e);
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
    fromName: settings?.custom_from_name || DEFAULT_FROM_NAME,
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
    headers: {
      "Authorization": `Basic ${btoa(`api:${apiKey}`)}`,
    },
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

    if (response.ok) {
      return { response, usedFallback: false };
    }

    if (response.status === 401 && emailConfig.fallbackApiKey) {
      console.warn("Primary Mailgun key returned 401, trying env fallback key");
      const fallbackResponse = await sendWithMailgun(emailConfig.fallbackApiKey, emailConfig.sendingDomain, mgPayload);

      if (fallbackResponse.ok) {
        if (emailConfig.settingsId) {
          await supabase
            .from("tenant_email_settings")
            .update({ mailgun_master_api_key: emailConfig.fallbackApiKey })
            .eq("id", emailConfig.settingsId);
          console.log("Synced mailgun_master_api_key with current env key");
        }
        return { response: fallbackResponse, usedFallback: true };
      }
      return { response: fallbackResponse, usedFallback: true };
    }

    if (response.status >= 500 && attempt < MAX_RETRIES) {
      console.warn(`Mailgun returned ${response.status}, retrying in ${RETRY_DELAYS[attempt]}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    return { response, usedFallback: false };
  }

  return { response: await sendWithMailgun(emailConfig.apiKey, emailConfig.sendingDomain, mgPayload), usedFallback: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== supabaseServiceKey) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid or expired authentication token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const body: EmailRequest = await req.json();
    const { organizationId, to, subject, html, text, replyTo, cc, bcc, attachments, unsubscribeUrl } = body;

    if (!organizationId || !to || !subject || !html) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: organizationId, to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailConfig = await getEmailConfig(supabase, organizationId);

    if (!emailConfig.apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: emailConfig.error, needsSetup: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toAddresses = Array.isArray(to) ? to : [to];
    const primaryRecipient = toAddresses[0]?.toLowerCase() || "";

    const effectiveUnsubscribeUrl = unsubscribeUrl ||
      `https://bizzypro.app/unsubscribe?org=${encodeURIComponent(organizationId)}&email=${encodeURIComponent(primaryRecipient)}`;

    const mgPayload: Record<string, string> = {
      from: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
      to: toAddresses.join(","),
      subject,
      html,
      "h:List-Unsubscribe": `<${effectiveUnsubscribeUrl}>`,
      "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };

    if (text) mgPayload.text = text;
    if (replyTo) mgPayload["h:Reply-To"] = replyTo;
    if (cc && cc.length > 0) mgPayload.cc = cc.join(",");
    if (bcc && bcc.length > 0) mgPayload.bcc = bcc.join(",");

    console.log("Tenant email ->", JSON.stringify({ from: mgPayload.from, to: mgPayload.to, subject }));

    const { response: emailResponse, usedFallback } = await sendEmailWithRetry(
      { apiKey: emailConfig.apiKey!, fallbackApiKey: emailConfig.fallbackApiKey, sendingDomain: emailConfig.sendingDomain, settingsId: emailConfig.settingsId },
      mgPayload,
      supabase,
    );

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`Mailgun error (${emailResponse.status}):`, errorText, "from:", mgPayload.from);
      const userError = emailResponse.status === 401
        ? "Email service authorization failed. The Mailgun API key may be invalid or expired -- please check your email settings or contact support."
        : `Failed to send email (${emailResponse.status}). Please check your email domain configuration in Settings.`;
      return new Response(
        JSON.stringify({ success: false, error: userError, details: errorText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (usedFallback) {
      console.log("Email sent successfully using fallback API key");
    }

    const emailResult = await emailResponse.json();

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully", emailId: emailResult.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
