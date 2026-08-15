import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConversationThread {
  phone_number: string;
  client_id: string | null;
  client_name: string | null;
  last_message: string;
  last_message_time: string;
  last_direction: string;
  unread_count: number;
  opt_status: string;
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
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
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

    if (!tenantNumber) {
      return new Response(
        JSON.stringify({
          conversations: [],
          total: 0,
          message: "No phone number configured for this organization"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: messages, error: messagesError } = await supabase
      .from("sms_messages")
      .select("from_number, to_number, body, direction, created_at, client_id, clients(id, name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (messagesError) {
      console.error("Query error:", messagesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conversationMap = new Map<string, ConversationThread>();

    for (const msg of messages || []) {
      const externalNumber = msg.direction === "inbound" ? msg.from_number : msg.to_number;

      if (externalNumber === tenantNumber) continue;

      if (!conversationMap.has(externalNumber)) {
        conversationMap.set(externalNumber, {
          phone_number: externalNumber,
          client_id: msg.client_id || null,
          client_name: (msg.clients as { id: string; name: string } | null)?.name || null,
          last_message: msg.body,
          last_message_time: msg.created_at,
          last_direction: msg.direction,
          unread_count: 0,
          opt_status: "pending",
        });
      }
    }

    const phoneNumbers = Array.from(conversationMap.keys());

    if (phoneNumbers.length > 0) {
      const { data: optStatuses } = await supabase
        .from("sms_opt_status")
        .select("phone_number, status")
        .eq("organization_id", organizationId)
        .in("phone_number", phoneNumbers);

      for (const opt of optStatuses || []) {
        const conv = conversationMap.get(opt.phone_number);
        if (conv) {
          conv.opt_status = opt.status;
        }
      }
    }

    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime())
      .slice(offset, offset + limit);

    return new Response(
      JSON.stringify({
        conversations,
        total: conversationMap.size,
        tenant_number: tenantNumber,
        limit,
        offset,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("List SMS conversations error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
