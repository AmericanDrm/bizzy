import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CampaignRegistrationRequest {
  organization_id: string;
  use_case: string;
  use_case_description: string;
  sample_messages: string[];
  opt_in_message?: string;
  opt_out_message?: string;
  help_message?: string;
  message_flow?: string;
  has_embedded_links?: boolean;
  has_embedded_phone?: boolean;
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

    const body: CampaignRegistrationRequest = await req.json();
    const {
      organization_id,
      use_case,
      use_case_description,
      sample_messages,
      opt_in_message,
      opt_out_message,
      help_message,
      message_flow = "Users opt-in via our website or mobile app. They can opt-out at any time by replying STOP.",
      has_embedded_links = false,
      has_embedded_phone = false,
    } = body;

    if (!organization_id || !use_case || !use_case_description || !sample_messages || sample_messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields for campaign registration" }),
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

    if (settingsError || !smsSettings) {
      return new Response(
        JSON.stringify({ error: "SMS settings not found. Please provision a phone number first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!smsSettings.a2p_brand_id || smsSettings.a2p_brand_status === "unregistered") {
      return new Response(
        JSON.stringify({ error: "Brand registration required before campaign registration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (smsSettings.a2p_brand_id.startsWith("PENDING_")) {
      return new Response(
        JSON.stringify({ error: "Brand registration did not complete successfully. Please re-register your brand first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (smsSettings.a2p_campaign_id &&
        !smsSettings.a2p_campaign_id.startsWith("CAMPAIGN_PENDING_") &&
        smsSettings.a2p_campaign_status !== "failed") {
      return new Response(
        JSON.stringify({
          error: "Campaign already registered",
          campaign_id: smsSettings.a2p_campaign_id,
          status: smsSettings.a2p_campaign_status
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const useCaseMap: Record<string, string> = {
      "appointment_reminders": "APPOINTMENT_REMINDERS",
      "customer_care": "CUSTOMER_CARE",
      "delivery_notifications": "DELIVERY_NOTIFICATIONS",
      "marketing": "MARKETING",
      "mixed": "MIXED",
      "notifications": "NOTIFICATIONS",
      "polling_voting": "POLLING_VOTING",
      "public_service_announcement": "PUBLIC_SERVICE_ANNOUNCEMENT",
      "security_alerts": "SECURITY_ALERTS",
      "account_notifications": "ACCOUNT_NOTIFICATIONS",
    };

    const twilioUseCase = useCaseMap[use_case.toLowerCase()] || "MIXED";

    const messagingServiceResponse = await fetch(
      `https://messaging.twilio.com/v1/Services`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          FriendlyName: `SMS Service - ${organization_id}`,
          InboundRequestUrl: `${supabaseUrl}/functions/v1/sms-webhook`,
          InboundMethod: "POST",
          StatusCallback: `${supabaseUrl}/functions/v1/sms-status-callback`,
          UseInboundWebhookOnNumber: "false",
        }).toString(),
      }
    );

    let messagingServiceSid = "";
    if (messagingServiceResponse.ok) {
      const msResult = await messagingServiceResponse.json();
      messagingServiceSid = msResult.sid;

      const phoneNumberSid = smsSettings.twilio_phone_number_sid;
      if (phoneNumberSid) {
        await fetch(
          `https://messaging.twilio.com/v1/Services/${messagingServiceSid}/PhoneNumbers`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              PhoneNumberSid: phoneNumberSid,
            }).toString(),
          }
        );
      } else if (smsSettings.twilio_phone_number) {
        const lookupResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(smsSettings.twilio_phone_number)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Basic ${twilioAuth}`,
            },
          }
        );

        if (lookupResponse.ok) {
          const lookupResult = await lookupResponse.json();
          if (lookupResult.incoming_phone_numbers?.length > 0) {
            const foundSid = lookupResult.incoming_phone_numbers[0].sid;

            await supabase
              .from("tenant_sms_settings")
              .update({ twilio_phone_number_sid: foundSid, updated_at: new Date().toISOString() })
              .eq("organization_id", organization_id);

            await fetch(
              `https://messaging.twilio.com/v1/Services/${messagingServiceSid}/PhoneNumbers`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Basic ${twilioAuth}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  PhoneNumberSid: foundSid,
                }).toString(),
              }
            );
          }
        }
      }
    } else {
      console.error("Messaging service creation error:", await messagingServiceResponse.text());
    }

    const campaignParams = new URLSearchParams({
      Description: use_case_description,
      MessageFlow: message_flow,
      UseCase: twilioUseCase,
      HasEmbeddedLinks: has_embedded_links.toString(),
      HasEmbeddedPhone: has_embedded_phone.toString(),
    });

    if (messagingServiceSid) {
      campaignParams.append("MessagingServiceSid", messagingServiceSid);
    }

    sample_messages.forEach((msg) => {
      campaignParams.append("SampleMessages", msg);
    });

    const campaignResponse = await fetch(
      `https://messaging.twilio.com/v1/a2p/BrandRegistrations/${smsSettings.a2p_brand_id}/Campaigns`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: campaignParams.toString(),
      }
    );

    let campaignSid = "";
    let campaignStatus = "pending";

    if (campaignResponse.ok) {
      const campaignResult = await campaignResponse.json();
      campaignSid = campaignResult.sid;
      campaignStatus = (campaignResult.status || "PENDING").toLowerCase();
    } else {
      const errorText = await campaignResponse.text();
      console.error("Twilio campaign registration error:", errorText);

      let parsedError = "";
      try {
        const errorJson = JSON.parse(errorText);
        parsedError = errorJson.message || errorJson.detail || errorText;
      } catch {
        parsedError = errorText;
      }

      return new Response(
        JSON.stringify({
          error: "Campaign registration failed with Twilio",
          details: parsedError,
          brand_id: smsSettings.a2p_brand_id,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updateData: Record<string, unknown> = {
      a2p_campaign_id: campaignSid,
      a2p_campaign_status: campaignStatus,
      use_case_description,
      updated_at: new Date().toISOString(),
    };

    if (messagingServiceSid) {
      updateData.messaging_service_sid = messagingServiceSid;
    }

    if (opt_in_message) updateData.opt_in_response = opt_in_message;
    if (opt_out_message) updateData.opt_out_response = opt_out_message;
    if (help_message) updateData.help_response = help_message;

    const { error: updateError } = await supabase
      .from("tenant_sms_settings")
      .update(updateData)
      .eq("organization_id", organization_id);

    if (updateError) {
      console.error("Database update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update campaign registration", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaignSid,
        messaging_service_sid: messagingServiceSid,
        status: campaignStatus,
        message: "Campaign registration submitted. SMS sending will be enabled once approved.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Register A2P campaign error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
