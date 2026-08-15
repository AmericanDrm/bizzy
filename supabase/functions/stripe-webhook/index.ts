import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import Stripe from "npm:stripe@14.21.0";

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
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !webhookSecret) {
      console.error("Missing required environment variables");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing Stripe signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ received: true, skipped: "not paid" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const invoiceId = session.metadata?.invoice_id;
      if (!invoiceId) {
        console.warn("No invoice_id in session metadata", session.id);
        return new Response(JSON.stringify({ received: true, skipped: "no invoice_id" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("id, payment_status, total, organization_id, invoice_number, client_id, cc_fee_amount, memo")
        .eq("id", invoiceId)
        .maybeSingle();

      if (fetchError || !invoice) {
        console.error("Invoice not found:", invoiceId);
        return new Response(JSON.stringify({ received: true, error: "Invoice not found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (invoice.payment_status === "paid") {
        return new Response(JSON.stringify({ received: true, skipped: "already paid" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountPaid = session.amount_total ? session.amount_total / 100 : Number(invoice.total);

      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          payment_status: "paid",
          payment_method: "card",
          amount_paid: amountPaid,
          paid_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (updateError) {
        console.error("Failed to update invoice:", updateError);
        return new Response(JSON.stringify({ received: true, error: "Failed to update invoice" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ccFeeAmount = Number(invoice.cc_fee_amount) || 0;
      const invoiceRef = invoice.memo ? invoice.memo : `#${invoice.invoice_number}`;
      const today = new Date().toISOString().split("T")[0];

      const { error: incomeError } = await supabase.from("income").insert({
        organization_id: invoice.organization_id,
        client_id: invoice.client_id || null,
        invoice_id: invoice.id,
        amount: amountPaid,
        description: `Invoice ${invoiceRef} - paid by card via Stripe`,
        date: today,
        category: "invoice",
        payment_method: "card",
      });

      if (incomeError) {
        console.error("Failed to insert income record:", incomeError);
      }

      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", invoice.organization_id)
        .in("role", ["owner", "admin"]);

      if (ccFeeAmount > 0 && orgMembers && orgMembers.length > 0) {
        const ownerUserId = orgMembers[0].user_id;
        const { error: expenseError } = await supabase.from("expenses").insert({
          user_id: ownerUserId,
          organization_id: invoice.organization_id,
          amount: ccFeeAmount,
          description: `CC processing fee — Invoice ${invoiceRef}`,
          date: today,
          category: "Credit Card Processing Fee",
        });
        if (expenseError) {
          console.error("Failed to insert CC fee expense:", expenseError);
        }
      }

      if (orgMembers && orgMembers.length > 0) {
        const clientData = invoice.client_id
          ? (await supabase.from("clients").select("name").eq("id", invoice.client_id).maybeSingle()).data
          : null;
        const clientName = clientData?.name || "A client";
        const notifTitle = "Invoice Paid";
        const notifBody = `${clientName} paid invoice ${invoiceRef} — $${amountPaid.toFixed(2)}${ccFeeAmount > 0 ? ` (incl. $${ccFeeAmount.toFixed(2)} card fee)` : ""}`;

        for (const member of orgMembers) {
          EdgeRuntime.waitUntil(
            fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                userId: member.user_id,
                title: notifTitle,
                body: notifBody,
                type: "invoice_paid",
                data: { invoiceId: invoice.id, amountPaid, ccFeeAmount },
              }),
            }).catch((e) => console.error("Failed to send push notification:", e))
          );
        }
      }

      const { data: businessSettings } = await supabase
        .from("business_settings")
        .select("send_receipt_email, include_google_review_on_receipt, google_review_url")
        .eq("organization_id", invoice.organization_id)
        .maybeSingle();

      const shouldSendReceipt = businessSettings?.send_receipt_email !== false;

      if (shouldSendReceipt && invoice.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("name, email, google_review_url")
          .eq("id", invoice.client_id)
          .maybeSingle();

        if (client?.email) {
          const googleReviewUrl = client.google_review_url ||
            (businessSettings?.include_google_review_on_receipt ? businessSettings.google_review_url : null);

          EdgeRuntime.waitUntil(
            fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                invoiceId,
                clientEmail: client.email,
                clientName: client.name,
                amountPaid,
                paidDate: new Date().toISOString(),
                googleReviewUrl: googleReviewUrl || null,
              }),
            }).catch((e) => console.error("Failed to trigger receipt email:", e))
          );
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
