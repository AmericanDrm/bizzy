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

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ success: false, error: "Stripe is not configured. Please add your Stripe secret key." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    if (token !== serviceRoleKey) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ success: false, error: "Invalid or expired authentication token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ success: false, error: "invoiceId is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, invoice_items(*), clients(name, email)")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ success: false, error: "Invoice not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoice.payment_status === "paid") {
      return new Response(JSON.stringify({ success: false, error: "This invoice is already paid" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: businessSettings } = await supabase
      .from("business_settings")
      .select("business_name, cc_processing_fee_percent")
      .eq("organization_id", invoice.organization_id)
      .maybeSingle();

    const businessName = businessSettings?.business_name || "Your Business";
    const totalCents = Math.round(Number(invoice.total) * 100);

    if (totalCents <= 0) {
      return new Response(JSON.stringify({ success: false, error: "Invoice total must be greater than zero" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    const lineItems = (invoice.invoice_items || []).map((item: any) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.description || "Service",
        },
        unit_amount: Math.round(Number(item.unit_price) * 100),
      },
      quantity: Number(item.quantity) || 1,
    }));

    if (lineItems.length === 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `Invoice #${invoice.invoice_number}` },
          unit_amount: totalCents,
        },
        quantity: 1,
      });
    }

    const appUrl = "https://bizzypro.app";
    const clientEmail = invoice.clients?.email;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${appUrl}/approve/${invoiceId}?stripe_success=true`,
      cancel_url: `${appUrl}/approve/${invoiceId}?stripe_cancel=true`,
      metadata: {
        invoice_id: invoiceId,
        organization_id: invoice.organization_id,
        invoice_number: invoice.invoice_number,
      },
      payment_intent_data: {
        metadata: {
          invoice_id: invoiceId,
          organization_id: invoice.organization_id,
        },
        description: `${businessName} - Invoice #${invoice.invoice_number}`,
      },
    };

    if (clientEmail) {
      sessionParams.customer_email = clientEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    await supabase
      .from("invoices")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", invoiceId);

    return new Response(JSON.stringify({ success: true, checkoutUrl: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error creating Stripe checkout:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
