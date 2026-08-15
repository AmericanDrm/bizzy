import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendSmsRequest {
  organization_id: string;
  to: string;
  body: string;
  client_id?: string;
}

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

    const { organization_id, to, body, client_id }: SendSmsRequest = await req.json();

    if (!organization_id || !to || !body) {
      return new Response(
        JSON.stringify({ error: "organization_id, to, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: "Access denied. Not a member of this organization." }),
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
        JSON.stringify({ error: "SMS not configured for this organization. Please provision a phone number first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!smsSettings.twilio_phone_number) {
      return new Response(
        JSON.stringify({ error: "No phone number provisioned for this organization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!smsSettings.is_active) {
      return new Response(
        JSON.stringify({ error: "SMS service is not active for this organization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedTo = normalizePhoneNumber(to);

    const { data: optStatus } = await supabase
      .from("sms_opt_status")
      .select("status")
      .eq("organization_id", organization_id)
      .eq("phone_number", normalizedTo)
      .maybeSingle();

    if (optStatus?.status === "opted_out") {
      return new Response(
        JSON.stringify({ error: "Cannot send message. Recipient has opted out." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: messageRecord, error: insertError } = await supabase
      .from("sms_messages")
      .insert({
        organization_id,
        from_number: smsSettings.twilio_phone_number,
        to_number: normalizedTo,
        body,
        direction: "outbound",
        status: "queued",
        client_id: client_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create message record:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create message record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    let messagingServiceSid = smsSettings.messaging_service_sid;

    if (!messagingServiceSid) {
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
                messagingServiceSid = service.sid;
                await supabase
                  .from("tenant_sms_settings")
                  .update({
                    messaging_service_sid: service.sid,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("organization_id", organization_id);
                break;
              }
            }
          }
        }
      } catch (e) {
        console.error("Messaging Service SID lookup error:", e);
      }
    }

    const twilioParams = new URLSearchParams({
      To: normalizedTo,
      Body: body,
      StatusCallback: `${supabaseUrl}/functions/v1/sms-status-callback?message_id=${messageRecord.id}`,
    });

    if (messagingServiceSid) {
      twilioParams.set("MessagingServiceSid", messagingServiceSid);
    } else {
      twilioParams.set("From", smsSettings.twilio_phone_number);
    }

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: twilioParams.toString(),
      }
    );

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio send error:", twilioResult);

      await supabase
        .from("sms_messages")
        .update({
          status: "failed",
          error_code: twilioResult.code?.toString() || "unknown",
          error_message: twilioResult.message || "Failed to send message",
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageRecord.id);

      const userMessage = twilioResult.code === 21659
        ? "Your SMS phone number is no longer active. Please re-provision a new number in SMS settings."
        : twilioResult.code === 30032
        ? "Your toll-free number requires A2P registration. Please contact support."
        : twilioResult.message || "Failed to send SMS";

      return new Response(
        JSON.stringify({
          error: userMessage,
          details: twilioResult.message,
          code: twilioResult.code,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("sms_messages")
      .update({
        status: twilioResult.status || "sent",
        twilio_message_sid: twilioResult.sid,
        segments: twilioResult.num_segments || 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", messageRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageRecord.id,
        twilio_sid: twilioResult.sid,
        status: twilioResult.status,
        from: smsSettings.twilio_phone_number,
        to: normalizedTo,
        segments: twilioResult.num_segments || 1,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send SMS error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
