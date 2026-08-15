import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MG_BASE = "https://api.mailgun.net/v3";

interface DomainRequest {
  organizationId: string;
  action: "init" | "status" | "verify" | "remove";
  domain?: string;
}

async function mgGet(apiKey: string, path: string) {
  return fetch(`${MG_BASE}${path}`, {
    headers: { "Authorization": `Basic ${btoa(`api:${apiKey}`)}` },
  });
}

async function mgPost(apiKey: string, path: string, body?: Record<string, string>) {
  const form = new FormData();
  if (body) {
    for (const [k, v] of Object.entries(body)) form.append(k, v);
  }
  return fetch(`${MG_BASE}${path}`, {
    method: "POST",
    headers: { "Authorization": `Basic ${btoa(`api:${apiKey}`)}` },
    body: form,
  });
}

async function mgDelete(apiKey: string, path: string) {
  return fetch(`${MG_BASE}${path}`, {
    method: "DELETE",
    headers: { "Authorization": `Basic ${btoa(`api:${apiKey}`)}` },
  });
}

function normalizeMgDnsRecords(mgDomain: any): any[] {
  const records: any[] = [];

  if (mgDomain.sending_dns_records) {
    for (const r of mgDomain.sending_dns_records) {
      records.push({
        type: r.record_type,
        name: r.name,
        value: r.value,
        status: r.valid === "valid" ? "verified" : "pending",
        ttl: "3600",
        priority: r.record_type === "MX" ? r.priority : undefined,
      });
    }
  }

  if (mgDomain.receiving_dns_records) {
    for (const r of mgDomain.receiving_dns_records) {
      records.push({
        type: r.record_type,
        name: r.name,
        value: r.value,
        status: r.valid === "valid" ? "verified" : "pending",
        ttl: "3600",
        priority: r.priority,
      });
    }
  }

  return records;
}

function getMgDomainStatus(mgDomain: any): string {
  const allValid = [
    ...(mgDomain.sending_dns_records || []),
    ...(mgDomain.receiving_dns_records || []),
  ].every((r: any) => r.valid === "valid");

  return allValid ? "verified" : "pending";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !mailgunApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DomainRequest = await req.json();
    const { organizationId, action } = body;

    if (!organizationId || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "organizationId and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Only organization owners/admins can manage domains" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings } = await supabase
      .from("tenant_email_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    switch (action) {

      case "init": {
        if (!body.domain) {
          return new Response(
            JSON.stringify({ success: false, error: "Domain is required for initialization" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const normalizedDomain = body.domain.toLowerCase();

        const createRes = await mgPost(mailgunApiKey, "/domains", {
          name: normalizedDomain,
          smtp_password: crypto.randomUUID(),
        });

        let mgDomain: any;

        if (createRes.status === 409) {
          console.log(`Domain ${normalizedDomain} already exists in Mailgun, fetching existing...`);
          const getRes = await mgGet(mailgunApiKey, `/domains/${normalizedDomain}`);
          if (!getRes.ok) {
            return new Response(
              JSON.stringify({ success: false, error: "Domain already exists in Mailgun but could not be retrieved. Check your Mailgun dashboard." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const existing = await getRes.json();
          mgDomain = existing.domain || existing;
          mgDomain.sending_dns_records = existing.sending_dns_records;
          mgDomain.receiving_dns_records = existing.receiving_dns_records;
        } else if (!createRes.ok) {
          const errorText = await createRes.text();
          console.error("Mailgun domain create error:", errorText);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to initialize domain in Mailgun", details: errorText }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const created = await createRes.json();
          mgDomain = created.domain || created;
          mgDomain.sending_dns_records = created.sending_dns_records;
          mgDomain.receiving_dns_records = created.receiving_dns_records;
        }

        const dnsRecords = normalizeMgDnsRecords(mgDomain);
        const domainStatus = getMgDomainStatus(mgDomain);
        const isVerified = domainStatus === "verified";

        const { data: encryptionSecret } = await supabase.rpc("get_email_encryption_key");

        const updateData: Record<string, unknown> = {
          organization_id: organizationId,
          sending_domain: normalizedDomain,
          domain_id: normalizedDomain,
          domain_status: domainStatus,
          domain_records: dnsRecords,
          custom_from_email: `noreply@${normalizedDomain}`,
          is_active: isVerified,
          setup_completed_at: isVerified ? new Date().toISOString() : null,
        };

        if (encryptionSecret) {
          const { data: encryptedKey } = await supabase.rpc("encrypt_api_key", {
            api_key: mailgunApiKey,
            encryption_secret: encryptionSecret,
          });
          if (encryptedKey) updateData.mailgun_api_key_encrypted = encryptedKey;
        }

        if (settings) {
          await supabase.from("tenant_email_settings").update(updateData).eq("organization_id", organizationId);
        } else {
          await supabase.from("tenant_email_settings").insert(updateData);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: isVerified
              ? "Domain connected and verified! You can now send emails."
              : "Domain added to Mailgun. Please add the DNS records shown below, then click Verify.",
            domainId: normalizedDomain,
            status: domainStatus,
            records: dnsRecords,
            isActive: isVerified,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "status": {
        if (!settings?.domain_id) {
          return new Response(
            JSON.stringify({
              success: true,
              status: settings ? "no_custom_domain" : "not_configured",
              isActive: settings?.is_active || false,
              sendingDomain: settings?.sending_domain?.toLowerCase() || "bizzypro.app",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const statusRes = await mgGet(mailgunApiKey, `/domains/${settings.domain_id}`);

        if (!statusRes.ok) {
          return new Response(
            JSON.stringify({ success: false, error: "Failed to fetch domain status from Mailgun" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const statusData = await statusRes.json();
        const mgDomainData = statusData.domain || statusData;
        mgDomainData.sending_dns_records = statusData.sending_dns_records;
        mgDomainData.receiving_dns_records = statusData.receiving_dns_records;

        const dnsRecords = normalizeMgDnsRecords(mgDomainData);
        const domainStatus = getMgDomainStatus(mgDomainData);
        const isNowActive = domainStatus === "verified";

        await supabase.from("tenant_email_settings").update({
          domain_status: domainStatus,
          domain_records: dnsRecords,
          is_active: isNowActive,
          setup_completed_at: isNowActive ? new Date().toISOString() : null,
        }).eq("organization_id", organizationId);

        return new Response(
          JSON.stringify({
            success: true,
            status: domainStatus,
            isActive: isNowActive,
            records: dnsRecords,
            sendingDomain: settings.sending_domain.toLowerCase(),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "verify": {
        if (!settings?.domain_id) {
          return new Response(
            JSON.stringify({ success: false, error: "No domain configured" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const verifyRes = await mgGet(mailgunApiKey, `/domains/${settings.domain_id}`);

        if (!verifyRes.ok) {
          const errorText = await verifyRes.text();
          return new Response(
            JSON.stringify({ success: false, error: "Verification check failed", details: errorText }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const verifyData = await verifyRes.json();
        const mgDomainVerify = verifyData.domain || verifyData;
        mgDomainVerify.sending_dns_records = verifyData.sending_dns_records;
        mgDomainVerify.receiving_dns_records = verifyData.receiving_dns_records;

        const dnsRecords = normalizeMgDnsRecords(mgDomainVerify);
        const domainStatus = getMgDomainStatus(mgDomainVerify);
        const isVerified = domainStatus === "verified";

        await supabase.from("tenant_email_settings").update({
          domain_status: domainStatus,
          domain_records: dnsRecords,
          is_active: isVerified,
          setup_completed_at: isVerified ? new Date().toISOString() : null,
        }).eq("organization_id", organizationId);

        return new Response(
          JSON.stringify({
            success: true,
            message: isVerified ? "Domain verified! Emails will now be sent from your domain." : "DNS records not yet verified. Ensure all records are added, then try again.",
            status: domainStatus,
            isActive: isVerified,
            records: dnsRecords,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "remove": {
        if (settings?.domain_id) {
          await mgDelete(mailgunApiKey, `/domains/${settings.domain_id}`);
        }

        await supabase.from("tenant_email_settings").update({
          sending_domain: "bizzypro.app",
          domain_id: null,
          domain_status: "default",
          domain_records: null,
          custom_from_email: "notifications@bizzypro.app",
          mailgun_api_key_encrypted: null,
          is_active: true,
        }).eq("organization_id", organizationId);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Custom domain removed. Emails will now be sent from notifications@bizzypro.app.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error) {
    console.error("Domain management error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
