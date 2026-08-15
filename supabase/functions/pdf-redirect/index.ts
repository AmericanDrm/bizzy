import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response("Missing code parameter", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("short_links")
      .select("target_url, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (error || !data) {
      return new Response("PDF link not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (new Date(data.expires_at) < new Date()) {
      return new Response("This PDF link has expired", {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: data.target_url,
      },
    });
  } catch (err) {
    console.error("pdf-redirect error:", err);
    return new Response("Internal server error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
