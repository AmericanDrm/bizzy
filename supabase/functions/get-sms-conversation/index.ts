import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (!phone.startsWith("+")) {
    return `+${digits}`;
  }
  return phone;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organization_id");
    const phoneNumber = url.searchParams.get("phone_number");
    const clientId = url.searchParams.get("client_id");
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const before = url.searchParams.get("before");

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!phoneNumber && !clientId) {
      return new Response(
        JSON.stringify({ error: "phone_number or client_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: "Access denied. Not a member of this organization." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: smsSettings } = await supabase
      .from("tenant_sms_settings")
      .select("twilio_phone_number")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const tenantNumber = smsSettings?.twilio_phone_number;

    let targetPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

    if (clientId && !targetPhone) {
      const { data: client } = await supabase
        .from("clients")
        .select("phone")
        .eq("id", clientId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (client?.phone) {
        targetPhone = normalizePhoneNumber(client.phone);
      }
    }

    if (!targetPhone) {
      return new Response(
        JSON.stringify({ error: "Could not determine phone number for conversation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase
      .from("sms_messages")
      .select("*, clients(id, name, email, phone)", { count: "exact" })
      .eq("organization_id", organizationId)
      .or(`from_number.eq.${targetPhone},to_number.eq.${targetPhone}`)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: messages, error: queryError, count } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch conversation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: optStatus } = await supabase
      .from("sms_opt_status")
      .select("status, opted_out_at, opted_in_at")
      .eq("organization_id", organizationId)
      .eq("phone_number", targetPhone)
      .maybeSingle();

    const { data: client } = await supabase
      .from("clients")
      .select("id, name, email, phone")
      .eq("organization_id", organizationId)
      .or(`phone.eq.${targetPhone},phone.ilike.%${targetPhone.replace("+", "")}%`)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        conversation: {
          phone_number: targetPhone,
          tenant_number: tenantNumber,
          client: client || null,
          opt_status: optStatus?.status || "pending",
          opted_out_at: optStatus?.opted_out_at || null,
        },
        messages: messages || [],
        total: count || 0,
        limit,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get SMS conversation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
