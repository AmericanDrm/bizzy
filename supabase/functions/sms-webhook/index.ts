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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const twilioData: Record<string, string> = {};
    formData.forEach((value, key) => {
      twilioData[key] = value.toString();
    });

    const {
      MessageSid,
      From,
      To,
      Body,
      NumSegments,
      AccountSid,
    } = twilioData;

    if (!MessageSid || !From || !To || Body === undefined) {
      console.error("Missing required Twilio fields:", twilioData);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    console.log(`Inbound SMS: From=${From}, To=${To}, Body=${Body.substring(0, 50)}...`);

    const { data: smsSettings, error: settingsError } = await supabase
      .from("tenant_sms_settings")
      .select("*")
      .eq("twilio_phone_number", To)
      .maybeSingle();

    if (settingsError || !smsSettings) {
      console.error("No tenant found for phone number:", To);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>This number is not configured to receive messages.</Message></Response>',
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    const organizationId = smsSettings.organization_id;
    const messageBody = Body.trim().toUpperCase();

    const optOutKeywords = smsSettings.opt_out_keywords || ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
    const optInKeywords = smsSettings.opt_in_keywords || ["START", "YES", "UNSTOP"];
    const helpKeywords = smsSettings.help_keywords || ["HELP", "INFO"];

    let autoResponse: string | null = null;
    let optStatusUpdate: { status: string; opted_out_at?: string; opted_in_at?: string } | null = null;

    if (optOutKeywords.includes(messageBody)) {
      autoResponse = smsSettings.opt_out_response || "You have been unsubscribed and will no longer receive messages from us. Reply START to resubscribe.";
      optStatusUpdate = {
        status: "opted_out",
        opted_out_at: new Date().toISOString(),
      };
    } else if (optInKeywords.includes(messageBody)) {
      autoResponse = smsSettings.opt_in_response || "You have been resubscribed to receive messages from us. Reply STOP to unsubscribe.";
      optStatusUpdate = {
        status: "opted_in",
        opted_in_at: new Date().toISOString(),
      };
    } else if (helpKeywords.includes(messageBody)) {
      autoResponse = smsSettings.help_response || "Reply STOP to unsubscribe. Reply START to resubscribe. For support, contact us at our main number.";
    }

    if (optStatusUpdate) {
      const { data: existingOpt } = await supabase
        .from("sms_opt_status")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("phone_number", From)
        .maybeSingle();

      if (existingOpt) {
        await supabase
          .from("sms_opt_status")
          .update({
            ...optStatusUpdate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOpt.id);
      } else {
        await supabase
          .from("sms_opt_status")
          .insert({
            organization_id: organizationId,
            phone_number: From,
            ...optStatusUpdate,
          });
      }
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organizationId)
      .or(`phone.eq.${From},phone.ilike.%${From.replace("+", "")}%`)
      .maybeSingle();

    const { error: insertError } = await supabase
      .from("sms_messages")
      .insert({
        organization_id: organizationId,
        from_number: From,
        to_number: To,
        body: Body,
        direction: "inbound",
        status: "received",
        twilio_message_sid: MessageSid,
        segments: parseInt(NumSegments || "1", 10),
        client_id: client?.id || null,
      });

    if (insertError) {
      console.error("Failed to save inbound message:", insertError);
    }

    if (autoResponse) {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

      if (twilioAccountSid && twilioAuthToken) {
        const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

        const sendResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: From,
              From: To,
              Body: autoResponse,
            }).toString(),
          }
        );

        if (sendResponse.ok) {
          const sendResult = await sendResponse.json();

          await supabase
            .from("sms_messages")
            .insert({
              organization_id: organizationId,
              from_number: To,
              to_number: From,
              body: autoResponse,
              direction: "outbound",
              status: "sent",
              twilio_message_sid: sendResult.sid,
              client_id: client?.id || null,
            });
        }
      }

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("SMS webhook error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
