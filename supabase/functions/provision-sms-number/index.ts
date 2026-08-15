import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProvisionRequest {
  organization_id: string;
  area_code?: string;
  country?: string;
  replace_existing?: boolean;
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
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { organization_id, area_code, country = "US", replace_existing = false }: ProvisionRequest = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Owner or admin role required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingSettings } = await supabase
      .from("tenant_sms_settings")
      .select("twilio_phone_number, twilio_phone_number_sid")
      .eq("organization_id", organization_id)
      .maybeSingle();

    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    if (existingSettings?.twilio_phone_number && !replace_existing) {
      return new Response(
        JSON.stringify({
          error: "Organization already has a phone number",
          phone_number: existingSettings.twilio_phone_number
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (replace_existing && existingSettings?.twilio_phone_number_sid) {
      try {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${existingSettings.twilio_phone_number_sid}.json`,
          {
            method: "DELETE",
            headers: { "Authorization": `Basic ${twilioAuth}` },
          }
        );
      } catch (e) {
        console.error("Failed to release old number:", e);
      }
    }

    const searchParams = new URLSearchParams({
      SmsEnabled: "true",
      VoiceEnabled: "false",
    });

    if (area_code) {
      searchParams.append("AreaCode", area_code);
    }

    const searchResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/${country}/Local.json?${searchParams.toString()}`,
      {
        method: "GET",
        headers: { "Authorization": `Basic ${twilioAuth}` },
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Twilio search error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to search for available local numbers", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchResult = await searchResponse.json();

    if (!searchResult.available_phone_numbers || searchResult.available_phone_numbers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No available local phone numbers found. Try a different area code." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedNumber = searchResult.available_phone_numbers[0];

    const webhookUrl = `${supabaseUrl}/functions/v1/sms-webhook`;

    const purchaseResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          PhoneNumber: selectedNumber.phone_number,
          SmsUrl: webhookUrl,
          SmsMethod: "POST",
          FriendlyName: `Tenant-${organization_id}`,
        }).toString(),
      }
    );

    if (!purchaseResponse.ok) {
      const errorText = await purchaseResponse.text();
      console.error("Twilio purchase error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to purchase phone number", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const purchaseResult = await purchaseResponse.json();

    const updatePayload = {
      twilio_phone_number: purchaseResult.phone_number,
      twilio_phone_number_sid: purchaseResult.sid,
      is_active: true,
      a2p_brand_id: null as string | null,
      a2p_brand_status: null as string | null,
      a2p_campaign_id: null as string | null,
      a2p_campaign_status: null as string | null,
      updated_at: new Date().toISOString(),
    };

    if (existingSettings) {
      if (replace_existing) {
        const { error: updateError } = await supabase
          .from("tenant_sms_settings")
          .update(updatePayload)
          .eq("organization_id", organization_id);

        if (updateError) {
          console.error("Database update error:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update SMS settings", details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const { error: updateError } = await supabase
          .from("tenant_sms_settings")
          .update({
            twilio_phone_number: purchaseResult.phone_number,
            twilio_phone_number_sid: purchaseResult.sid,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organization_id);

        if (updateError) {
          console.error("Database update error:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update SMS settings", details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      const { error: insertError } = await supabase
        .from("tenant_sms_settings")
        .insert({
          organization_id,
          twilio_phone_number: purchaseResult.phone_number,
          twilio_phone_number_sid: purchaseResult.sid,
          is_active: true,
        });

      if (insertError) {
        console.error("Database insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to save SMS settings", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        phone_number: purchaseResult.phone_number,
        phone_number_sid: purchaseResult.sid,
        friendly_name: purchaseResult.friendly_name,
        number_type: "local",
        message: "Local phone number provisioned successfully. A2P 10DLC registration required for carrier compliance.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Provision SMS number error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
