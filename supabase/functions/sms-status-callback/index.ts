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

    const url = new URL(req.url);
    const messageId = url.searchParams.get("message_id");

    const formData = await req.formData();
    const twilioData: Record<string, string> = {};
    formData.forEach((value, key) => {
      twilioData[key] = value.toString();
    });

    const {
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage,
    } = twilioData;

    console.log(`SMS Status Update: SID=${MessageSid}, Status=${MessageStatus}, MessageID=${messageId}`);

    const statusMap: Record<string, string> = {
      "queued": "queued",
      "sending": "sending",
      "sent": "sent",
      "delivered": "delivered",
      "undelivered": "undelivered",
      "failed": "failed",
      "read": "delivered",
    };

    const normalizedStatus = statusMap[MessageStatus?.toLowerCase()] || MessageStatus?.toLowerCase() || "unknown";

    const updateData: Record<string, unknown> = {
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    };

    if (ErrorCode) {
      updateData.error_code = ErrorCode;
    }
    if (ErrorMessage) {
      updateData.error_message = ErrorMessage;
    }

    if (messageId) {
      const { error: updateError } = await supabase
        .from("sms_messages")
        .update(updateData)
        .eq("id", messageId);

      if (updateError) {
        console.error("Failed to update message by ID:", updateError);
      }
    } else if (MessageSid) {
      const { error: updateError } = await supabase
        .from("sms_messages")
        .update(updateData)
        .eq("twilio_message_sid", MessageSid);

      if (updateError) {
        console.error("Failed to update message by SID:", updateError);
      }
    }

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("SMS status callback error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
