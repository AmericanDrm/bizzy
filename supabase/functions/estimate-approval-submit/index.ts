import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      token,
      approvedItemIds,
      signatureData,
      signedByName,
      signedByEmail,
      clientNotes,
    } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing approval token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from("estimate_approval_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Invalid approval token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenRow.used_at) {
      return new Response(
        JSON.stringify({ error: "This estimate has already been approved" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This approval link has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", tokenRow.estimate_id)
      .maybeSingle();

    if (estimateError) {
      console.error("Error fetching estimate:", JSON.stringify(estimateError, null, 2));
      return new Response(
        JSON.stringify({ error: "Failed to fetch estimate", details: estimateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!estimate) {
      console.error("Estimate not found for id:", tokenRow.estimate_id);
      return new Response(
        JSON.stringify({ error: "Estimate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (estimate.status === "approved") {
      return new Response(
        JSON.stringify({ error: "This estimate has already been approved" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (estimate.requires_signature && !signatureData) {
      return new Response(
        JSON.stringify({ error: "Signature is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let resolvedName = signedByName?.trim() || tokenRow.client_name || null;
    let resolvedEmail = signedByEmail?.trim() || tokenRow.client_email || null;

    if (!resolvedName || !resolvedEmail) {
      const { data: clientFallback } = await supabase
        .from("clients")
        .select("name, email")
        .eq("id", estimate.client_id || "")
        .maybeSingle();

      resolvedName = resolvedName || clientFallback?.name || null;
      resolvedEmail = resolvedEmail || clientFallback?.email || null;

      if (!resolvedName) {
        return new Response(
          JSON.stringify({ error: "Could not determine client name for signature" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: items, error: itemsError } = await supabase
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", tokenRow.estimate_id);

    if (itemsError) {
      console.error("Error fetching estimate items:", JSON.stringify(itemsError, null, 2));
      return new Response(
        JSON.stringify({ error: "Failed to fetch estimate items", details: itemsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!items) {
      console.error("No items returned for estimate:", tokenRow.estimate_id);
      return new Response(
        JSON.stringify({ error: "No estimate items found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const approvedSet = new Set(approvedItemIds || []);
    let approvedSubtotal = 0;

    for (const item of items) {
      const isApproved = !item.is_optional || approvedSet.has(item.id);
      approvedSubtotal += isApproved ? Number(item.total) : 0;

      await supabase
        .from("estimate_items")
        .update({ approved_by_client: isApproved })
        .eq("id", item.id);
    }

    let discountAmount = Number(estimate.discount_amount) || 0;
    if (Number(estimate.discount_percentage) > 0) {
      discountAmount = (approvedSubtotal * Number(estimate.discount_percentage)) / 100;
    }

    const afterDiscount = Math.max(0, approvedSubtotal - discountAmount);
    const taxAmount = (afterDiscount * Number(estimate.tax_rate)) / 100;
    const total = afterDiscount + taxAmount;

    const updateData = {
      status: "approved",
      signed_at: new Date().toISOString(),
      signature_data: signatureData || null,
      signed_by_name: resolvedName,
      signed_by_email: resolvedEmail || "",
      client_notes: clientNotes?.trim() || null,
      subtotal: approvedSubtotal,
      tax_amount: taxAmount,
      total: total,
      updated_at: new Date().toISOString(),
    };

    console.log("Updating estimate", tokenRow.estimate_id, "with status: approved, subtotal:", approvedSubtotal, "total:", total);

    const { error: updateError } = await supabase
      .from("estimates")
      .update(updateData)
      .eq("id", tokenRow.estimate_id);

    if (updateError) {
      console.error("Failed to update estimate:", JSON.stringify(updateError, null, 2));
      console.error("Estimate ID:", tokenRow.estimate_id);
      console.error("Update payload:", JSON.stringify(updateData, null, 2));
      return new Response(
        JSON.stringify({
          error: "Failed to update estimate",
          details: updateError.message || updateError.code || "Unknown database error",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Estimate updated successfully");

    const { error: tokenUpdateError } = await supabase
      .from("estimate_approval_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    if (tokenUpdateError) {
      console.error("Failed to mark token as used:", tokenUpdateError);
    }

    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", estimate.client_id)
      .maybeSingle();

    try {
      const pushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
      const clientName = client?.name || "A client";
      await fetch(pushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          userId: estimate.user_id,
          title: "Estimate Approved!",
          body: `Yay! ${clientName} Approved your Estimate, Schedule now`,
          type: "estimate_approved",
          data: {
            estimateId: tokenRow.estimate_id,
            clientName,
            estimateNumber: estimate.estimate_number,
          },
        }),
      });
    } catch (pushError) {
      console.error("Failed to send push notification:", pushError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Estimate approved successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
