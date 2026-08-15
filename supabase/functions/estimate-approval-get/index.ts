import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let token = "";

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token") || "";
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        token = body.token || "";
      } catch (e) {
        console.error("Failed to parse request body:", e);
      }
    }

    if (!token) {
      console.error("No token provided in request");
      return new Response(
        JSON.stringify({ error: "No approval token provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Looking up token:", token.substring(0, 10) + "...");

    const { data: tokenRow, error: tokenError } = await supabase
      .from("estimate_approval_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      console.error("Error fetching token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Database error while validating token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenRow) {
      console.error("Token not found in database");
      return new Response(
        JSON.stringify({ error: "Invalid approval link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Token found, estimate_id:", tokenRow.estimate_id);

    if (tokenRow.used_at) {
      console.error("Token already used at:", tokenRow.used_at);
      return new Response(
        JSON.stringify({ error: "This estimate has already been approved" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      console.error("Token expired at:", tokenRow.expires_at);
      return new Response(
        JSON.stringify({ error: "This approval link has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", tokenRow.estimate_id)
      .maybeSingle();

    if (estimateError) {
      console.error("Error fetching estimate:", estimateError);
      return new Response(
        JSON.stringify({ error: "Database error while fetching estimate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!estimate) {
      console.error("Estimate not found for id:", tokenRow.estimate_id);
      return new Response(
        JSON.stringify({ error: "Estimate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Estimate found:", estimate.estimate_number);

    if (estimate.status === "approved") {
      console.log("Estimate already approved");
      return new Response(
        JSON.stringify({ error: "This estimate has already been approved" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", tokenRow.estimate_id)
      .order("display_order", { ascending: true });

    if (itemsError) {
      console.error("Error fetching estimate items:", itemsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch estimate items" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${items?.length || 0} items`);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, email, phone, address")
      .eq("id", estimate.client_id)
      .maybeSingle();

    if (clientError) {
      console.error("Error fetching client:", clientError);
    }

    const { data: business, error: businessError } = await supabase
      .from("business_settings")
      .select("business_name, business_phone, business_email, business_address, logo_url")
      .eq("organization_id", estimate.organization_id)
      .maybeSingle();

    if (businessError) {
      console.error("Error fetching business settings:", businessError);
    }

    console.log("Returning complete estimate data");

    return new Response(
      JSON.stringify({
        estimate: {
          id: estimate.id,
          estimate_number: estimate.estimate_number,
          issue_date: estimate.issue_date,
          valid_until: estimate.valid_until,
          subtotal: estimate.subtotal,
          tax_rate: estimate.tax_rate,
          tax_amount: estimate.tax_amount,
          discount_amount: estimate.discount_amount || 0,
          discount_percentage: estimate.discount_percentage || 0,
          total: estimate.total,
          notes: estimate.notes || "",
          requires_signature: estimate.requires_signature || false,
          status: estimate.status,
        },
        items: items || [],
        business: {
          business_name: business?.business_name || "",
          business_phone: business?.business_phone || "",
          business_email: business?.business_email || "",
          business_address: business?.business_address || "",
          logo_url: business?.logo_url || "",
        },
        client: {
          name: client?.name || "",
          email: client?.email || "",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unhandled error in estimate-approval-get:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
