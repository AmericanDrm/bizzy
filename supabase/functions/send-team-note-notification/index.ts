// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TeamNotePayload {
  organizationId: string;
  authorId: string;
  title: string;
  body: string;
  teamNoteId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: TeamNotePayload = await req.json();
    const { organizationId, authorId, title, body, teamNoteId } = payload;

    if (!organizationId || !authorId || !title || !body) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: organizationId, authorId, title, body",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: authorRole } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", authorId)
      .maybeSingle();

    if (!authorRole || !["owner", "admin"].includes(authorRole.role)) {
      return new Response(
        JSON.stringify({ error: "Only admins and owners can send team notes" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: clockedInEntries } = await supabase
      .from("time_entries")
      .select("user_id")
      .eq("organization_id", organizationId)
      .is("clock_out", null);

    const clockedInUserIds = [
      ...new Set(
        (clockedInEntries || [])
          .map((e: { user_id: string }) => e.user_id)
          .filter((uid: string) => uid !== authorId)
      ),
    ];

    if (clockedInUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: "No clocked-in team members to notify",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token, user_id")
      .in("user_id", clockedInUserIds)
      .eq("active", true);

    if (!tokens || tokens.length === 0) {
      for (const uid of clockedInUserIds) {
        await supabase.from("push_notifications").insert({
          user_id: uid,
          title,
          body,
          data: { type: "team_note", teamNoteId },
          type: "general",
          delivered: false,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: "No active push tokens for clocked-in members",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const messages = tokens.map((t: { token: string; user_id: string }) => ({
      to: t.token,
      sound: "default",
      title,
      body,
      data: { type: "team_note", teamNoteId },
      priority: "high",
      channelId: "default",
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
          } else if (tickets[i].details?.error === "DeviceNotRegistered") {
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
          .eq("token", token);
      }
    }

    const notifiedUserIds = [
      ...new Set(tokens.map((t: { user_id: string }) => t.user_id)),
    ];
    for (const uid of notifiedUserIds) {
      await supabase.from("push_notifications").insert({
        user_id: uid,
        title,
        body,
        data: { type: "team_note", teamNoteId },
        type: "general",
        delivered: totalSent > 0,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        clockedInMembers: clockedInUserIds.length,
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
