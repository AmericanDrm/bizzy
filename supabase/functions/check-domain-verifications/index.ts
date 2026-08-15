import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function mgGet(apiKey: string, path: string): Promise<Response> {
  return fetch(`https://api.mailgun.net${path}`, {
    method: "GET",
    headers: { "Authorization": `Basic ${btoa(`api:${apiKey}`)}` },
  });
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: pendingDomains, error: fetchError } = await supabase
      .from("tenant_email_settings")
      .select("organization_id, domain_id, sending_domain, domain_status")
      .not("domain_id", "is", null)
      .neq("domain_status", "verified")
      .neq("domain_status", "default");

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch pending domains" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingDomains || pendingDomains.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending domains to check", checked: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let verified = 0;
    let checked = 0;

    for (const domain of pendingDomains) {
      checked++;

      const domainName = domain.sending_domain;
      if (!domainName) continue;

      const domainRes = await mgGet(mailgunApiKey, `/v3/domains/${domainName}`);
      if (!domainRes.ok) continue;

      const domainData = await domainRes.json();
      const sendingRecords: Array<{ valid: string }> = domainData.sending_dns_records ?? [];
      const allValid = sendingRecords.length > 0 && sendingRecords.every((r) => r.valid === "valid");

      if (allValid) {
        verified++;

        await supabase
          .from("tenant_email_settings")
          .update({
            domain_status: "verified",
            is_active: true,
            setup_completed_at: new Date().toISOString(),
          })
          .eq("organization_id", domain.organization_id);

        const { data: admins } = await supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", domain.organization_id)
          .in("role", ["owner", "admin"]);

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                userId: admin.user_id,
                title: "Domain Verified",
                body: `Your email domain ${domainName} is now active!`,
                type: "domain_verified",
                data: { organizationId: domain.organization_id, domain: domainName },
              }),
            });
          }
        }
      } else {
        const newStatus = sendingRecords.length > 0 ? "pending" : "failed";
        if (newStatus !== domain.domain_status) {
          await supabase
            .from("tenant_email_settings")
            .update({ domain_status: newStatus })
            .eq("organization_id", domain.organization_id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${checked} pending domains, ${verified} newly verified`,
        checked,
        verified,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Domain verification check error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
