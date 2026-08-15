import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "No organization found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { phone_number } = await req.json();
    if (!phone_number || typeof phone_number !== "string") {
      return new Response(
        JSON.stringify({ error: "phone_number is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const digits = phone_number.replace(/\D/g, "");
    const normalized =
      digits.length === 11 && digits.startsWith("1")
        ? digits.slice(1)
        : digits;

    if (normalized.length < 7) {
      return new Response(
        JSON.stringify({ matches: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: clients, error: queryError } = await supabase
      .from("clients")
      .select(
        "id, name, phone, email, address, client_type, secondary_contact_name, secondary_contact_phone"
      )
      .eq("organization_id", membership.organization_id);

    if (queryError) {
      return new Response(
        JSON.stringify({ error: "Query failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const matches: Array<{
      clientId: string;
      clientName: string;
      phone: string;
      email: string;
      address: string;
      clientType: string;
      isSecondary: boolean;
    }> = [];

    for (const client of clients || []) {
      if (client.phone) {
        const clientDigits = client.phone.replace(/\D/g, "");
        const clientNormalized =
          clientDigits.length === 11 && clientDigits.startsWith("1")
            ? clientDigits.slice(1)
            : clientDigits;
        if (
          clientNormalized === normalized ||
          clientNormalized.endsWith(normalized.slice(-7))
        ) {
          matches.push({
            clientId: client.id,
            clientName: client.name || "",
            phone: client.phone,
            email: client.email || "",
            address: client.address || "",
            clientType: client.client_type || "residential",
            isSecondary: false,
          });
        }
      }
      if (client.secondary_contact_phone) {
        const secDigits = client.secondary_contact_phone.replace(/\D/g, "");
        const secNormalized =
          secDigits.length === 11 && secDigits.startsWith("1")
            ? secDigits.slice(1)
            : secDigits;
        if (
          secNormalized === normalized ||
          secNormalized.endsWith(normalized.slice(-7))
        ) {
          matches.push({
            clientId: client.id,
            clientName: client.secondary_contact_name || client.name || "",
            phone: client.secondary_contact_phone,
            email: client.email || "",
            address: client.address || "",
            clientType: client.client_type || "residential",
            isSecondary: true,
          });
        }
      }
    }

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
