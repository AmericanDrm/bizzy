import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BrandRegistrationRequest {
  organization_id: string;
  company_name: string;
  ein: string;
  company_website?: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  contact_email: string;
  contact_phone: string;
  vertical?: string;
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

    const body: BrandRegistrationRequest = await req.json();
    const {
      organization_id,
      company_name,
      ein,
      company_website,
      street_address,
      city,
      state,
      postal_code,
      country = "US",
      contact_email,
      contact_phone,
      vertical = "PROFESSIONAL_SERVICES",
    } = body;

    if (!organization_id || !company_name || !ein || !street_address || !city || !state || !postal_code || !contact_email || !contact_phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields for brand registration" }),
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

    const { data: smsSettings, error: settingsError } = await supabase
      .from("tenant_sms_settings")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (settingsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch SMS settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (smsSettings?.a2p_brand_id &&
        !smsSettings.a2p_brand_id.startsWith("PENDING_") &&
        smsSettings.a2p_brand_status !== "failed") {
      return new Response(
        JSON.stringify({
          error: "Brand already registered",
          brand_id: smsSettings.a2p_brand_id,
          status: smsSettings.a2p_brand_status
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const einDigits = ein.replace(/\D/g, "");
    const errors: string[] = [];

    const customerProfileResponse = await fetch(
      `https://trusthub.twilio.com/v1/CustomerProfiles`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          FriendlyName: `${company_name} - ${organization_id}`,
          Email: contact_email,
          PolicySid: "RNdfbf3fae0e1107f8aded0e7cead80bf5",
        }).toString(),
      }
    );

    let customerProfileSid = "";
    if (customerProfileResponse.ok) {
      const cpResult = await customerProfileResponse.json();
      customerProfileSid = cpResult.sid;
    } else {
      const cpError = await customerProfileResponse.text();
      console.error("Customer profile creation error:", cpError);
      errors.push(`Customer profile: ${cpError}`);
    }

    if (customerProfileSid) {
      const endUserResponse = await fetch(
        `https://trusthub.twilio.com/v1/EndUsers`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${twilioAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            FriendlyName: company_name,
            Type: "us_a2p_messaging_profile_information",
            "Attributes": JSON.stringify({
              company_name,
              company_type: "PRIVATE",
              ein: einDigits,
              ein_issuing_country: country,
              stock_exchange: "NONE",
              website_url: company_website || "",
              social_media_profile_urls: "",
              regions_of_operations: "USA_AND_CANADA",
              business_contact_email: contact_email,
              business_contact_phone: contact_phone,
              street_address,
              city,
              state,
              postal_code,
              country,
              business_industry: vertical,
            }),
          }).toString(),
        }
      );

      if (endUserResponse.ok) {
        const euResult = await endUserResponse.json();

        await fetch(
          `https://trusthub.twilio.com/v1/CustomerProfiles/${customerProfileSid}/EntityAssignments`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ ObjectSid: euResult.sid }).toString(),
          }
        );
      } else {
        const euError = await endUserResponse.text();
        console.error("End user creation error:", euError);
        errors.push(`End user: ${euError}`);
      }

      const evalResponse = await fetch(
        `https://trusthub.twilio.com/v1/CustomerProfiles/${customerProfileSid}/Evaluations`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${twilioAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            PolicySid: "RNdfbf3fae0e1107f8aded0e7cead80bf5",
          }).toString(),
        }
      );

      if (evalResponse.ok) {
        await fetch(
          `https://trusthub.twilio.com/v1/CustomerProfiles/${customerProfileSid}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ Status: "pending-review" }).toString(),
          }
        );
      }
    }

    const brandRegBody: Record<string, string> = { BrandType: "STANDARD" };
    if (customerProfileSid) {
      brandRegBody.CustomerProfileBundleSid = customerProfileSid;
    }

    const brandRegResponse = await fetch(
      `https://messaging.twilio.com/v1/a2p/BrandRegistrations`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(brandRegBody).toString(),
      }
    );

    let brandSid = "";
    let brandStatus = "";

    if (brandRegResponse.ok) {
      const brandResult = await brandRegResponse.json();
      brandSid = brandResult.sid;
      brandStatus = (brandResult.status || "PENDING").toLowerCase();
    } else {
      const brandError = await brandRegResponse.text();
      console.error("Twilio brand registration error:", brandError);
      errors.push(`Brand registration: ${brandError}`);
    }

    if (!brandSid) {
      return new Response(
        JSON.stringify({
          error: "Brand registration failed with Twilio. Check your Twilio account setup and try again.",
          details: errors.join(" | "),
          customer_profile_sid: customerProfileSid || null,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: encryptedEin } = await supabase.rpc("encrypt_ein", {
      ein: einDigits,
      org_id: organization_id,
    });

    const updateData = {
      company_name,
      company_ein_encrypted: encryptedEin || einDigits,
      company_website: company_website || null,
      a2p_brand_id: brandSid,
      a2p_brand_status: brandStatus,
      updated_at: new Date().toISOString(),
    };

    if (smsSettings) {
      const { error: updateError } = await supabase
        .from("tenant_sms_settings")
        .update(updateData)
        .eq("organization_id", organization_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update brand registration", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("tenant_sms_settings")
        .insert({ organization_id, ...updateData });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save brand registration", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        brand_id: brandSid,
        customer_profile_sid: customerProfileSid || null,
        status: brandStatus,
        message: "Brand registration submitted. Campaign registration required next.",
        next_step: "register-a2p-campaign",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Register A2P brand error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
