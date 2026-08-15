import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_DOMAIN = "bizzypro.app";
const DEFAULT_FROM_EMAIL = "notifications@bizzypro.app";

interface SetupRequest {
  organizationId: string;
  customFromName?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !mailgunApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== serviceRoleKey) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid or expired authentication token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const body: SetupRequest = await req.json();
    const { organizationId, customFromName } = body;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: "organizationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ success: false, error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromName = customFromName || org.name || "Your Business";

    const { data: existing } = await supabase
      .from("tenant_email_settings")
      .select("id, domain_id, sending_domain")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existing?.domain_id && existing?.sending_domain?.toLowerCase() !== DEFAULT_DOMAIN) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email is already configured with a custom domain.",
          sendingDomain: existing.sending_domain,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settingsData = {
      organization_id: organizationId,
      sending_domain: DEFAULT_DOMAIN,
      custom_from_name: fromName,
      custom_from_email: DEFAULT_FROM_EMAIL,
      domain_id: null,
      domain_status: "default",
      domain_records: null,
      is_active: true,
      setup_completed_at: new Date().toISOString(),
      mailgun_master_api_key: mailgunApiKey,
    };

    if (existing) {
      await supabase.from("tenant_email_settings").update(settingsData).eq("organization_id", organizationId);
    } else {
      await supabase.from("tenant_email_settings").insert(settingsData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email configured successfully. Emails will be sent from notifications@bizzypro.app.",
        sendingDomain: DEFAULT_DOMAIN,
        fromEmail: DEFAULT_FROM_EMAIL,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Setup email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
