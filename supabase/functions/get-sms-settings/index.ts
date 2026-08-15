import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const refresh = url.searchParams.get("refresh") === "true";

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

    let { data: smsSettings, error: settingsError } = await supabase
      .from("tenant_sms_settings")
      .select(`
        id,
        organization_id,
        twilio_phone_number,
        twilio_phone_number_sid,
        messaging_service_sid,
        a2p_brand_id,
        a2p_brand_status,
        a2p_campaign_id,
        a2p_campaign_status,
        company_name,
        company_website,
        use_case_description,
        opt_in_keywords,
        opt_out_keywords,
        help_keywords,
        help_response,
        opt_out_response,
        opt_in_response,
        is_active,
        created_at,
        updated_at
      `)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (settingsError) {
      console.error("Settings query error:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch SMS settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioConfigured = !!(twilioAccountSid && twilioAuthToken);

    if (refresh && twilioConfigured && smsSettings) {
      const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      const updates: Record<string, unknown> = {};

      if (smsSettings.twilio_phone_number && !smsSettings.twilio_phone_number_sid) {
        try {
          const lookupResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(smsSettings.twilio_phone_number)}`,
            {
              method: "GET",
              headers: { "Authorization": `Basic ${twilioAuth}` },
            }
          );
          if (lookupResponse.ok) {
            const lookupResult = await lookupResponse.json();
            if (lookupResult.incoming_phone_numbers?.length > 0) {
              updates.twilio_phone_number_sid = lookupResult.incoming_phone_numbers[0].sid;
            }
          }
        } catch (e) {
          console.error("Phone number SID lookup error:", e);
        }
      }

      if (smsSettings.a2p_brand_id && !smsSettings.a2p_brand_id.startsWith("PENDING_")) {
        try {
          const brandResponse = await fetch(
            `https://messaging.twilio.com/v1/a2p/BrandRegistrations/${smsSettings.a2p_brand_id}`,
            {
              method: "GET",
              headers: { "Authorization": `Basic ${twilioAuth}` },
            }
          );
          if (brandResponse.ok) {
            const brandResult = await brandResponse.json();
            const newStatus = (brandResult.status || "").toLowerCase();
            if (newStatus && newStatus !== smsSettings.a2p_brand_status) {
              updates.a2p_brand_status = newStatus;
            }
          }
        } catch (e) {
          console.error("Brand status check error:", e);
        }
      }

      if (smsSettings.a2p_campaign_id && !smsSettings.a2p_campaign_id.startsWith("CAMPAIGN_PENDING_")) {
        try {
          const campaignResponse = await fetch(
            `https://messaging.twilio.com/v1/a2p/BrandRegistrations/${smsSettings.a2p_brand_id}/Campaigns/${smsSettings.a2p_campaign_id}`,
            {
              method: "GET",
              headers: { "Authorization": `Basic ${twilioAuth}` },
            }
          );
          if (campaignResponse.ok) {
            const campaignResult = await campaignResponse.json();
            const newStatus = (campaignResult.status || "").toLowerCase();
            if (newStatus && newStatus !== smsSettings.a2p_campaign_status) {
              updates.a2p_campaign_status = newStatus;
            }
          }
        } catch (e) {
          console.error("Campaign status check error:", e);
        }
      }

      if (!smsSettings.messaging_service_sid && smsSettings.twilio_phone_number) {
        try {
          const servicesResponse = await fetch(
            `https://messaging.twilio.com/v1/Services`,
            {
              method: "GET",
              headers: { "Authorization": `Basic ${twilioAuth}` },
            }
          );
          if (servicesResponse.ok) {
            const servicesResult = await servicesResponse.json();
            for (const service of servicesResult.services || []) {
              const phonesResponse = await fetch(
                `https://messaging.twilio.com/v1/Services/${service.sid}/PhoneNumbers`,
                {
                  method: "GET",
                  headers: { "Authorization": `Basic ${twilioAuth}` },
                }
              );
              if (phonesResponse.ok) {
                const phonesResult = await phonesResponse.json();
                const match = (phonesResult.phone_numbers || []).find(
                  (p: { phone_number: string }) => p.phone_number === smsSettings.twilio_phone_number
                );
                if (match) {
                  updates.messaging_service_sid = service.sid;
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.error("Messaging Service SID lookup error:", e);
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase
          .from("tenant_sms_settings")
          .update(updates)
          .eq("organization_id", organizationId);

        const { data: refreshed } = await supabase
          .from("tenant_sms_settings")
          .select(`
            id, organization_id, twilio_phone_number, twilio_phone_number_sid,
            messaging_service_sid,
            a2p_brand_id, a2p_brand_status, a2p_campaign_id, a2p_campaign_status,
            company_name, company_website, use_case_description,
            opt_in_keywords, opt_out_keywords, help_keywords,
            help_response, opt_out_response, opt_in_response,
            is_active, created_at, updated_at
          `)
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (refreshed) smsSettings = refreshed;
      }
    }

    const { count: messageCount } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    const { count: inboundCount } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("direction", "inbound");

    const { count: outboundCount } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("direction", "outbound");

    const hasPlaceholderBrand = smsSettings?.a2p_brand_id?.startsWith("PENDING_") || false;
    const hasPlaceholderCampaign = smsSettings?.a2p_campaign_id?.startsWith("CAMPAIGN_PENDING_") || false;

    const setupStatus = {
      has_phone_number: !!smsSettings?.twilio_phone_number,
      has_brand_registration: !!smsSettings?.a2p_brand_id && !hasPlaceholderBrand && smsSettings?.a2p_brand_status !== "unregistered",
      has_campaign_registration: !!smsSettings?.a2p_campaign_id && !hasPlaceholderCampaign && smsSettings?.a2p_campaign_status !== "unregistered",
      brand_needs_reregistration: hasPlaceholderBrand,
      campaign_needs_reregistration: hasPlaceholderCampaign,
      is_fully_configured: smsSettings?.is_active &&
        !!smsSettings?.twilio_phone_number &&
        !hasPlaceholderBrand &&
        !hasPlaceholderCampaign &&
        smsSettings?.a2p_brand_status === "approved" &&
        smsSettings?.a2p_campaign_status === "approved",
      can_send_messages: smsSettings?.is_active && !!smsSettings?.twilio_phone_number,
    };

    return new Response(
      JSON.stringify({
        settings: smsSettings || null,
        setup_status: setupStatus,
        twilio_configured: twilioConfigured,
        stats: {
          total_messages: messageCount || 0,
          inbound_messages: inboundCount || 0,
          outbound_messages: outboundCount || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get SMS settings error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
