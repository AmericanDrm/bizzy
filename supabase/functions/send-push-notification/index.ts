// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: PushPayload = await req.json();
    const { userId, title, body, type, data } = payload;

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .eq("active", true);

    if (tokenError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch push tokens" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!tokens || tokens.length === 0) {
      await supabase.from("push_notifications").insert({
        user_id: userId,
        title,
        body,
        data: data || {},
        type: type || "general",
        delivered: false,
      });

      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active push tokens found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: "default",
      title,
      body,
      data: { ...data, type },
      priority: "high",
      channelId:
        type === "clock_out_prompt"
          ? "clock-out"
          : type === "work_order_arrival"
            ? "arrivals"
            : "default",
    }));

    const chunks: Array<typeof messages> = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let totalSent = 0;
    const invalidTokens: string[] = [];

    for (const chunk of chunks) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (response.ok) {
        const result = await response.json();
        const tickets = result.data || [];

        for (let i = 0; i < tickets.length; i++) {
          if (tickets[i].status === "ok") {
            totalSent++;
          } else if (
            tickets[i].details?.error === "DeviceNotRegistered"
          ) {
            invalidTokens.push(chunk[i].to);
          }
        }
      }
    }

    if (invalidTokens.length > 0) {
      for (const token of invalidTokens) {
        await supabase
          .from("push_tokens")
          .update({ active: false })
          .eq("token", token)
          .eq("user_id", userId);
      }
    }

    await supabase.from("push_notifications").insert({
      user_id: userId,
      title,
      body,
      data: data || {},
      type: type || "general",
      delivered: totalSent > 0,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        invalidTokensDeactivated: invalidTokens.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
