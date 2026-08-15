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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: pending, error: fetchError } = await supabase
      .from("organization_lifecycle_emails")
      .select("id, email_type, scheduled_at")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No emails due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { id: string; type: string; success: boolean }[] = [];

    for (const item of pending) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-lifecycle-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ lifecycle_email_id: item.id }),
        });

        const json = await res.json();
        results.push({ id: item.id, type: item.email_type, success: json.success === true });
      } catch {
        results.push({ id: item.id, type: item.email_type, success: false });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({ processed: results.length, sent: successCount, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
