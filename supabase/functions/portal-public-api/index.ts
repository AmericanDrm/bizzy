import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function serviceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const action = url.searchParams.get("action");
      const slug = url.searchParams.get("slug");
      if (action === "settings" && slug) return await handleGetSettings(slug);
      if (action === "payment_methods" && slug) return await handleGetPaymentMethods(slug);
      return json({ error: "Invalid request" }, 400);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;

      if (action === "lookup") return await handleEmailLookup(body.slug, body.email);
      if (action === "lookup_by_name") return await handleNameLookup(body.slug, body.name);
      if (action === "register") return await handleRegister(body.slug, body.email, body.password);
      if (action === "reset_password") return await handleResetPassword(body.slug, body.email);
      if (action === "update_last_login") return await handleUpdateLastLogin(req);
      if (action === "update_profile") return await handleUpdateProfile(req, body);
      if (action === "get_availability") return await handleGetAvailability(body.slug, body.year, body.month);
      if (action === "notify_callback_request") return await handleNotifyCallbackRequest(req, body.work_request_id);
      if (action === "send_booking_confirmation") return await handleSendBookingConfirmation(req, body.work_request_id);
      if (action === "guest_booking") return await handleGuestBooking(body);
      if (action === "notify_request_decision") return await handleNotifyRequestDecision(req, body);
      if (action === "create_checkout") return await handleCreateCheckout(req, body);

      return json({ error: "Invalid action" }, 400);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyPortalJwt(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const db = serviceClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function verifyOrgMember(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (token === serviceRoleKey) return { id: "service_role", role: "service_role" };
  const db = serviceClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function handleGetSettings(slug: string) {
  const db = serviceClient();

  const { data: org, error: orgErr } = await db
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (orgErr || !org) return json({ error: "Organization not found" }, 404);

  const { data: settings, error: settingsErr } = await db
    .from("client_portal_settings")
    .select("is_enabled, portal_title, welcome_message, booking_start_time, booking_end_time, available_days, allow_guest_booking, primary_color, logo_url, contact_phone, max_bookings_per_day, cancellation_hours_notice, require_deposit, deposit_amount, deposit_type, send_booking_confirmation_email, payment_instructions")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (settingsErr) return json({ error: "Failed to load settings" }, 500);

  return json({
    organization: { id: org.id, name: org.name, slug: org.slug },
    settings: settings ?? null,
  });
}

async function handleGetPaymentMethods(slug: string) {
  const db = serviceClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return json({ error: "Organization not found" }, 404);

  const { data: bs } = await db
    .from("business_settings")
    .select("stripe_payment_link, venmo_username, cashapp_username, zelle_email, zelle_phone, check_payable_to, check_mailing_address, cc_processing_fee_percent")
    .eq("organization_id", org.id)
    .maybeSingle();

  const { data: ps } = await db
    .from("client_portal_settings")
    .select("payment_instructions")
    .eq("organization_id", org.id)
    .maybeSingle();

  return json({
    payment_methods: {
      stripe_payment_link: bs?.stripe_payment_link || null,
      venmo_username: bs?.venmo_username || null,
      cashapp_username: bs?.cashapp_username || null,
      zelle_email: bs?.zelle_email || null,
      zelle_phone: bs?.zelle_phone || null,
      check_payable_to: bs?.check_payable_to || null,
      check_mailing_address: bs?.check_mailing_address || null,
      cc_processing_fee_percent: bs?.cc_processing_fee_percent || 0,
    },
    payment_instructions: ps?.payment_instructions || "",
  });
}

async function handleCreateCheckout(req: Request, body: Record<string, unknown>) {
  const user = await verifyPortalJwt(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { slug, invoiceId } = body as { slug: string; invoiceId: string };
  if (!slug || !invoiceId) return json({ error: "slug and invoiceId are required" }, 400);

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!stripeSecretKey) return json({ error: "Card payments are not configured for this business." }, 503);

  const db = serviceClient();

  const { data: account } = await db
    .from("client_portal_accounts")
    .select("client_id, organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!account) return json({ error: "Account not found" }, 404);

  const { data: invoice } = await db
    .from("invoices")
    .select("id, invoice_number, total, payment_status, organization_id, client_id, invoice_items(description, unit_price, quantity)")
    .eq("id", invoiceId)
    .eq("organization_id", account.organization_id)
    .maybeSingle();

  if (!invoice) return json({ error: "Invoice not found" }, 404);
  if (invoice.client_id !== account.client_id) return json({ error: "Unauthorized" }, 403);
  if (invoice.payment_status === "paid") return json({ error: "This invoice is already paid" }, 400);

  const totalCents = Math.round(Number(invoice.total) * 100);
  if (totalCents <= 0) return json({ error: "Invoice total must be greater than zero" }, 400);

  const { data: businessSettings } = await db
    .from("business_settings")
    .select("business_name")
    .eq("organization_id", invoice.organization_id)
    .maybeSingle();

  const businessName = businessSettings?.business_name || "Your Business";
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

  const lineItems = (invoice.invoice_items || [])
    .filter((item: any) => Number(item.unit_price) > 0)
    .map((item: any) => ({
      price_data: {
        currency: "usd",
        product_data: { name: item.description || "Service" },
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
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: `${appUrl}/portal/${slug}/dashboard?stripe_success=true&invoice=${invoiceId}`,
    cancel_url: `${appUrl}/portal/${slug}/dashboard?stripe_cancel=true&invoice=${invoiceId}`,
    metadata: {
      invoice_id: invoice.id,
      organization_id: invoice.organization_id,
      invoice_number: invoice.invoice_number,
    },
    payment_intent_data: {
      metadata: { invoice_id: invoice.id, organization_id: invoice.organization_id },
      description: `${businessName} - Invoice #${invoice.invoice_number}`,
    },
  };

  const { data: client } = await db
    .from("clients")
    .select("email")
    .eq("id", account.client_id)
    .maybeSingle();
  if (client?.email) sessionParams.customer_email = client.email.toLowerCase();

  const session = await stripe.checkout.sessions.create(sessionParams);

  await db
    .from("invoices")
    .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  return json({ checkoutUrl: session.url });
}

async function handleNameLookup(slug: string, name: string) {
  if (!slug || !name) return json({ error: "slug and name are required" }, 400);
  if (name.trim().length < 2) return json({ error: "Name must be at least 2 characters" }, 400);

  const db = serviceClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return json({ matches: [] });

  const { data: clients } = await db
    .from("clients")
    .select("id, name, email, portal_email, phone, address, city, state, is_portal_enabled")
    .eq("organization_id", org.id)
    .eq("is_portal_enabled", true)
    .ilike("name", `%${name.trim()}%`)
    .limit(10);

  if (!clients || clients.length === 0) return json({ matches: [] });

  function maskEmail(e: string | null): string {
    if (!e) return "";
    const [local, domain] = e.split("@");
    if (!domain) return e;
    const visible = local.slice(0, Math.min(2, local.length));
    const masked = "*".repeat(Math.max(2, local.length - 2));
    const [domainName, ...tld] = domain.split(".");
    const domainMasked = domainName.slice(0, 1) + "*".repeat(Math.max(1, domainName.length - 1));
    return `${visible}${masked}@${domainMasked}.${tld.join(".")}`;
  }

  function maskAddress(street: string | null, city: string | null, state: string | null): string {
    if (!street && !city) return "";
    const parts = [];
    if (street) {
      const words = street.split(" ");
      if (words.length > 1) {
        parts.push(words[0] + " " + words.slice(1).map((w: string) => w[0] + "*".repeat(w.length - 1)).join(" "));
      } else {
        parts.push(street.slice(0, 3) + "***");
      }
    }
    if (city) parts.push(city);
    if (state) parts.push(state);
    return parts.join(", ");
  }

  const matches = (clients as Array<{
    id: string;
    name: string;
    email: string | null;
    portal_email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    is_portal_enabled: boolean;
  }>).map((c) => {
    const primaryEmail = c.portal_email || c.email;
    const maskedEmail = maskEmail(primaryEmail);
    const maskedAddr = maskAddress(c.address, c.city, c.state);
    return {
      id: c.id,
      name: c.name,
      masked_email: maskedEmail,
      masked_address: maskedAddr,
      has_email: !!primaryEmail,
    };
  });

  return json({ matches });
}

async function handleUpdateProfile(req: Request, body: Record<string, unknown>) {
  const user = await verifyPortalJwt(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { name, phone, notification_preference } = body as {
    name?: string;
    phone?: string;
    notification_preference?: string;
  };

  const db = serviceClient();

  const { data: account } = await db
    .from("client_portal_accounts")
    .select("client_id, organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) return json({ error: "Account not found" }, 404);

  const updates: Record<string, string> = {};
  if (name && name.trim().length >= 2) updates.name = name.trim();
  if (phone !== undefined) updates.phone = phone.trim();
  if (notification_preference && ["email", "text", "both", "none"].includes(notification_preference)) {
    updates.notification_preference = notification_preference;
  }

  if (Object.keys(updates).length === 0) return json({ ok: true });

  const { error } = await db
    .from("clients")
    .update(updates)
    .eq("id", account.client_id)
    .eq("organization_id", account.organization_id);

  if (error) return json({ error: "Failed to update profile" }, 500);

  return json({ ok: true });
}

async function handleEmailLookup(slug: string, email: string) {
  if (!slug || !email) return json({ error: "slug and email are required" }, 400);

  const db = serviceClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return json({ found: false, name: null });

  const normalizedEmail = email.trim().toLowerCase();

  const { data: client } = await db
    .from("clients")
    .select("id, name, email, portal_email, is_portal_enabled")
    .eq("organization_id", org.id)
    .or(`email.ilike.${normalizedEmail},portal_email.ilike.${normalizedEmail}`)
    .maybeSingle();

  if (!client) return json({ found: false, name: null });

  const { data: portalAccount } = await db
    .from("client_portal_accounts")
    .select("id, is_active")
    .eq("client_id", client.id)
    .maybeSingle();

  return json({
    found: true,
    name: client.name,
    is_portal_enabled: client.is_portal_enabled ?? false,
    has_account: !!portalAccount && portalAccount.is_active,
  });
}

async function handleRegister(slug: string, email: string, password: string) {
  if (!slug || !email || !password) {
    return json({ error: "slug, email, and password are required" }, 400);
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, 400);
  }

  const db = serviceClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return json({ error: "Organization not found" }, 404);

  const normalizedEmail = email.trim().toLowerCase();

  const { data: client } = await db
    .from("clients")
    .select("id, name, is_portal_enabled")
    .eq("organization_id", org.id)
    .or(`email.ilike.${normalizedEmail},portal_email.ilike.${normalizedEmail}`)
    .maybeSingle();

  if (!client) {
    return json({ error: "No client record found for this email. Please contact " + org.name + " to be added." }, 404);
  }

  if (!client.is_portal_enabled) {
    return json({ error: "Portal access has not been enabled for your account. Please contact " + org.name + "." }, 403);
  }

  const { data: existingAccount } = await db
    .from("client_portal_accounts")
    .select("id, is_active")
    .eq("client_id", client.id)
    .maybeSingle();

  if (existingAccount) {
    if (existingAccount.is_active) {
      return json({ error: "An account already exists for this email. Please sign in instead." }, 409);
    }
    return json({ error: "This account has been deactivated. Please contact " + org.name + "." }, 403);
  }

  const { data: authData, error: createErr } = await db.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      portal_client: true,
      client_name: client.name,
      organization_id: org.id,
    },
  });

  if (createErr || !authData.user) {
    if (createErr?.message?.includes("already registered")) {
      return json({ error: "An auth account already exists for this email. Try signing in." }, 409);
    }
    return json({ error: createErr?.message ?? "Failed to create account" }, 500);
  }

  const { error: linkErr } = await db.from("client_portal_accounts").insert({
    client_id: client.id,
    organization_id: org.id,
    user_id: authData.user.id,
    is_active: true,
  });

  if (linkErr) {
    await db.auth.admin.deleteUser(authData.user.id);
    return json({ error: "Failed to link account. Please try again." }, 500);
  }

  return json({ ok: true, message: "Account created successfully. You can now sign in." });
}

async function handleResetPassword(slug: string, email: string) {
  if (!slug || !email) return json({ error: "slug and email are required" }, 400);

  const db = serviceClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return json({ error: "Organization not found" }, 404);

  const normalizedEmail = email.trim().toLowerCase();

  const { data: client } = await db
    .from("clients")
    .select("id")
    .eq("organization_id", org.id)
    .or(`email.ilike.${normalizedEmail},portal_email.ilike.${normalizedEmail}`)
    .maybeSingle();

  if (!client) return json({ ok: true });

  const { data: account } = await db
    .from("client_portal_accounts")
    .select("user_id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) return json({ ok: true });

  await db.auth.admin.generateLink({
    type: "recovery",
    email: normalizedEmail,
  });

  return json({ ok: true });
}

async function handleUpdateLastLogin(req: Request) {
  const user = await verifyPortalJwt(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = serviceClient();
  await db
    .from("client_portal_accounts")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return json({ ok: true });
}

async function handleGetAvailability(slug: string, year: number, month: number) {
  if (!slug || !year || !month) return json({ error: "slug, year, month required" }, 400);

  const db = serviceClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return json({ error: "Organization not found" }, 404);

  const { data: settings } = await db
    .from("client_portal_settings")
    .select("booking_start_time, booking_end_time, available_days, is_enabled, contact_phone")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!settings || !settings.is_enabled) {
    return json({ error: "Portal not available" }, 403);
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const { data: events } = await db
    .from("schedule_events")
    .select("scheduled_date, start_time, end_time, status")
    .eq("organization_id", org.id)
    .gte("scheduled_date", startDate)
    .lt("scheduled_date", endDate)
    .not("status", "eq", "cancelled");

  const { data: workRequests } = await db
    .from("client_work_requests")
    .select("requested_date, requested_start_time, requested_end_time, status")
    .eq("organization_id", org.id)
    .gte("requested_date", startDate)
    .lt("requested_date", endDate)
    .in("status", ["pending", "approved"]);

  const busyWindows: Record<string, Array<{ start: string; end: string }>> = {};

  const startTime = settings.booking_start_time ? String(settings.booking_start_time).slice(0, 5) : "08:00";
  const endTime = settings.booking_end_time ? String(settings.booking_end_time).slice(0, 5) : "17:00";

  for (const ev of events ?? []) {
    if (!ev.scheduled_date) continue;
    const d = ev.scheduled_date;
    if (!busyWindows[d]) busyWindows[d] = [];
    if (ev.start_time && ev.end_time) {
      busyWindows[d].push({ start: String(ev.start_time).slice(0, 5), end: String(ev.end_time).slice(0, 5) });
    } else {
      busyWindows[d].push({ start: startTime, end: endTime });
    }
  }

  for (const wr of workRequests ?? []) {
    if (!wr.requested_date) continue;
    const d = wr.requested_date;
    if (!busyWindows[d]) busyWindows[d] = [];
    busyWindows[d].push({ start: wr.requested_start_time, end: wr.requested_end_time });
  }

  return json({
    working_hours: {
      start_time: startTime,
      end_time: endTime,
      available_days: settings.available_days || ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    contact_phone: settings.contact_phone || "",
    busy_windows: busyWindows,
  });
}

async function handleGuestBooking(body: Record<string, unknown>) {
  const { slug, guest_name, guest_email, guest_phone, guest_notification_preference, requested_date, requested_start_time, requested_end_time, service_type, notes } = body as Record<string, string>;

  if (!slug || !guest_name || !guest_email || !requested_date || !requested_start_time) {
    return json({ error: "Name, email, date, and start time are required" }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(guest_email)) {
    return json({ error: "Please enter a valid email address" }, 400);
  }

  const db = serviceClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return json({ error: "Organization not found" }, 404);

  const { data: settings } = await db
    .from("client_portal_settings")
    .select("is_enabled, allow_guest_booking, send_booking_confirmation_email, portal_title, primary_color")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!settings?.is_enabled || !settings?.allow_guest_booking) {
    return json({ error: "Guest booking is not available" }, 403);
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: recentCount } = await db
    .from("client_work_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("guest_email", guest_email.trim().toLowerCase())
    .gte("created_at", fiveMinAgo);

  if ((recentCount ?? 0) >= 3) {
    return json({ error: "Too many requests. Please wait a few minutes before trying again." }, 429);
  }

  const { data: inserted, error: insertErr } = await db
    .from("client_work_requests")
    .insert({
      organization_id: org.id,
      client_id: null,
      portal_account_id: null,
      guest_name: guest_name.trim(),
      guest_email: guest_email.trim().toLowerCase(),
      guest_phone: (guest_phone || "").trim(),
      guest_notification_preference: guest_notification_preference || "email",
      requested_date,
      requested_start_time,
      requested_end_time: requested_end_time || requested_start_time,
      service_type: (service_type || "").trim(),
      notes: (notes || "").trim(),
      phone_call_requested: false,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) {
    return json({ error: "Failed to submit request. Please try again." }, 500);
  }

  const formattedDate = new Date(requested_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const portalTitle = settings.portal_title || org.name || "Service Portal";
  const primaryColor = settings.primary_color || "#007AFF";

  const members = await db
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", org.id);

  const userIds = (members.data ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length) {
    const { data: tokens } = await db
      .from("push_tokens")
      .select("token")
      .in("user_id", userIds)
      .eq("active", true);

    if (tokens?.length) {
      const messages = (tokens as Array<{ token: string }>).map((t) => ({
        to: t.token,
        sound: "default",
        title: "New Guest Booking Request",
        body: `${guest_name.trim()} (guest) requested an appointment on ${formattedDate}`,
        data: { type: "guest_booking", work_request_id: inserted.id },
        priority: "high",
        channelId: "default",
      }));
      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        });
      } catch {}
    }
  }

  if (settings.send_booking_confirmation_email) {
    const timeLabel = requested_start_time || "";
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:${primaryColor};padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600">${portalTitle}</h1>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#1c1c1e">Booking Request Received</h2>
      <p style="margin:0 0 24px;color:#6c6c70;font-size:15px">Hi ${guest_name.trim()}, we've received your booking request and will follow up shortly.</p>
      <div style="background:#f9f9fb;border-radius:10px;padding:20px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#8e8e93;font-size:13px;width:110px">Date</td><td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${formattedDate}</td></tr>
          ${timeLabel ? `<tr><td style="padding:6px 0;color:#8e8e93;font-size:13px">Time</td><td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${timeLabel}</td></tr>` : ""}
          ${service_type ? `<tr><td style="padding:6px 0;color:#8e8e93;font-size:13px">Service</td><td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${service_type}</td></tr>` : ""}
          ${notes ? `<tr><td style="padding:6px 0;color:#8e8e93;font-size:13px;vertical-align:top">Notes</td><td style="padding:6px 0;color:#1c1c1e;font-size:14px">${notes}</td></tr>` : ""}
        </table>
      </div>
      <p style="margin:0;color:#8e8e93;font-size:13px;line-height:1.6">${org.name} will review your request and get back to you. If you have questions, please contact us directly.</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f2f2f7"><p style="margin:0;color:#c7c7cc;font-size:12px">Sent via ${portalTitle}</p></div>
  </div>
</body></html>`;

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-tenant-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ organizationId: org.id, to: guest_email.trim().toLowerCase(), subject: `Booking Request Received – ${formattedDate}`, html }),
      });
    } catch {}
  }

  return json({
    ok: true,
    request_id: inserted.id,
    summary: { guest_name: guest_name.trim(), guest_email: guest_email.trim().toLowerCase(), requested_date, requested_start_time, requested_end_time: requested_end_time || requested_start_time, service_type: (service_type || "").trim(), notes: (notes || "").trim() },
  });
}

async function handleNotifyRequestDecision(req: Request, body: Record<string, unknown>) {
  const user = await verifyOrgMember(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { work_request_id, decision, decline_reason } = body as { work_request_id: string; decision: string; decline_reason?: string };
  if (!work_request_id || !decision) return json({ error: "work_request_id and decision required" }, 400);

  const db = serviceClient();

  const { data: wr } = await db
    .from("client_work_requests")
    .select("id, organization_id, client_id, guest_name, guest_email, guest_phone, guest_notification_preference, requested_date, requested_start_time, service_type, notes")
    .eq("id", work_request_id)
    .maybeSingle();

  if (!wr) return json({ error: "Work request not found" }, 404);

  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("id", wr.organization_id)
    .maybeSingle();

  const { data: settings } = await db
    .from("client_portal_settings")
    .select("portal_title, primary_color")
    .eq("organization_id", wr.organization_id)
    .maybeSingle();

  const orgName = org?.name || "The business";
  const portalTitle = settings?.portal_title || orgName;
  const primaryColor = settings?.primary_color || "#007AFF";
  const isApproved = decision === "approved";
  const statusColor = isApproved ? "#34C759" : "#FF3B30";
  const statusText = isApproved ? "Approved" : "Declined";

  const formattedDate = new Date(wr.requested_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const isGuest = !wr.client_id && wr.guest_email;
  let contactEmail = wr.guest_email;
  let contactPhone = wr.guest_phone;
  let contactName = wr.guest_name || "Guest";
  let notifPref = wr.guest_notification_preference || "email";

  if (wr.client_id) {
    const { data: client } = await db
      .from("clients")
      .select("name, email, phone, notification_preference")
      .eq("id", wr.client_id)
      .maybeSingle();
    if (client) {
      contactEmail = client.email;
      contactPhone = client.phone;
      contactName = client.name;
      notifPref = client.notification_preference || "email";
    }
  }

  const shouldEmail = notifPref === "email" || notifPref === "both";
  const shouldText = notifPref === "text" || notifPref === "both";

  if (shouldEmail && contactEmail) {
    const declineNote = !isApproved && decline_reason ? `<p style="margin:16px 0 0;padding:12px;background:#fff5f5;border-radius:8px;color:#8b0000;font-size:14px">${decline_reason}</p>` : "";
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:${primaryColor};padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600">${portalTitle}</h1>
    </div>
    <div style="padding:32px">
      <div style="display:inline-block;padding:4px 12px;border-radius:6px;background:${statusColor}20;color:${statusColor};font-size:13px;font-weight:700;margin-bottom:16px">${statusText}</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#1c1c1e">Your Booking Request Has Been ${statusText}</h2>
      <p style="margin:0 0 24px;color:#6c6c70;font-size:15px">Hi ${contactName.split(" ")[0]}, ${isApproved ? `your appointment request for ${formattedDate} has been confirmed.` : `unfortunately your request for ${formattedDate} could not be accommodated at this time.`}</p>
      <div style="background:#f9f9fb;border-radius:10px;padding:20px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#8e8e93;font-size:13px;width:110px">Date</td><td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${formattedDate}</td></tr>
          <tr><td style="padding:6px 0;color:#8e8e93;font-size:13px">Time</td><td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${wr.requested_start_time}</td></tr>
          ${wr.service_type ? `<tr><td style="padding:6px 0;color:#8e8e93;font-size:13px">Service</td><td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${wr.service_type}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#8e8e93;font-size:13px">Status</td><td style="padding:6px 0;color:${statusColor};font-size:14px;font-weight:700">${statusText}</td></tr>
        </table>
      </div>
      ${declineNote}
      <p style="margin:16px 0 0;color:#8e8e93;font-size:13px;line-height:1.6">${isApproved ? "We look forward to seeing you! If you need to make any changes, please contact us." : `Please contact ${orgName} if you'd like to reschedule.`}</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f2f2f7"><p style="margin:0;color:#c7c7cc;font-size:12px">Sent via ${portalTitle}</p></div>
  </div>
</body></html>`;

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-tenant-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ organizationId: wr.organization_id, to: contactEmail, subject: `Booking ${statusText} – ${formattedDate}`, html }),
      });
    } catch {}
  }

  if (shouldText && contactPhone) {
    const smsBody = isApproved
      ? `${orgName}: Your appointment on ${formattedDate} at ${wr.requested_start_time} has been confirmed!`
      : `${orgName}: Your booking request for ${formattedDate} has been declined.${decline_reason ? " Reason: " + decline_reason : ""} Please contact us to reschedule.`;
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ organizationId: wr.organization_id, to: contactPhone, body: smsBody }),
      });
    } catch {}
  }

  if (wr.client_id) {
    try {
      const messageBody = isApproved
        ? `Your booking request for ${formattedDate} has been approved!`
        : `Your booking request for ${formattedDate} has been declined.${decline_reason ? " Reason: " + decline_reason : ""}`;
      await db.from("portal_messages").insert({
        organization_id: wr.organization_id,
        client_id: wr.client_id,
        sender_type: "org",
        message: messageBody,
        is_read: false,
      });
    } catch {}
  }

  return json({ ok: true });
}

async function handleNotifyCallbackRequest(req: Request, workRequestId: string) {
  if (!workRequestId) return json({ error: "work_request_id required" }, 400);

  const user = await verifyPortalJwt(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = serviceClient();

  const { data: wr } = await db
    .from("client_work_requests")
    .select("id, organization_id, client_id, requested_date, requested_start_time, phone_call_requested")
    .eq("id", workRequestId)
    .maybeSingle();

  if (!wr) return json({ error: "Work request not found" }, 404);

  const { data: account } = await db
    .from("client_portal_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", wr.organization_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) return json({ error: "Unauthorized" }, 403);

  const { data: client } = await db
    .from("clients")
    .select("name, phone")
    .eq("id", wr.client_id)
    .maybeSingle();

  const clientName = client?.name ?? "A client";

  const { data: members } = await db
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", wr.organization_id);

  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (!userIds.length) return json({ ok: true, sent: 0 });

  const { data: tokens } = await db
    .from("push_tokens")
    .select("token")
    .in("user_id", userIds)
    .eq("active", true);

  if (!tokens?.length) return json({ ok: true, sent: 0 });

  const isCallback = wr.phone_call_requested;
  const title = isCallback ? "Callback Requested" : "New Scheduling Request";
  const pushBody = isCallback
    ? `${clientName} wants a callback — ${wr.requested_date} at ${wr.requested_start_time}`
    : `${clientName} requested an appointment on ${wr.requested_date} at ${wr.requested_start_time}`;

  const messages = (tokens as Array<{ token: string }>).map((t) => ({
    to: t.token,
    sound: "default",
    title,
    body: pushBody,
    data: {
      type: "scheduling_request",
      work_request_id: workRequestId,
      phone_call_requested: wr.phone_call_requested,
      client_phone: client?.phone ?? "",
    },
    priority: "high",
    channelId: "default",
  }));

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });

  return json({ ok: true });
}

async function handleSendBookingConfirmation(req: Request, workRequestId: string) {
  if (!workRequestId) return json({ error: "work_request_id required" }, 400);

  const user = await verifyPortalJwt(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = serviceClient();

  const { data: wr } = await db
    .from("client_work_requests")
    .select("id, organization_id, client_id, requested_date, requested_start_time, requested_end_time, service_type, notes")
    .eq("id", workRequestId)
    .maybeSingle();

  if (!wr) return json({ error: "Work request not found" }, 404);

  const { data: account } = await db
    .from("client_portal_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", wr.organization_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) return json({ error: "Unauthorized" }, 403);

  const { data: settings } = await db
    .from("client_portal_settings")
    .select("send_booking_confirmation_email, portal_title, primary_color")
    .eq("organization_id", wr.organization_id)
    .maybeSingle();

  if (!settings?.send_booking_confirmation_email) return json({ ok: true, skipped: true });

  const { data: client } = await db
    .from("clients")
    .select("name, email")
    .eq("id", wr.client_id)
    .maybeSingle();

  if (!client?.email) return json({ ok: true, skipped: true });

  const { data: orgData } = await db
    .from("organizations")
    .select("name")
    .eq("id", wr.organization_id)
    .maybeSingle();

  const portalTitle = settings.portal_title || orgData?.name || "Service Portal";
  const primaryColor = settings.primary_color || "#007AFF";

  const formattedDate = new Date(wr.requested_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const timeRange = wr.requested_start_time
    ? wr.requested_end_time
      ? `${wr.requested_start_time} – ${wr.requested_end_time}`
      : wr.requested_start_time
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:${primaryColor};padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600">${portalTitle}</h1>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#1c1c1e">Booking Request Received</h2>
      <p style="margin:0 0 24px;color:#6c6c70;font-size:15px">Hi ${client.name}, we've received your booking request and will confirm shortly.</p>
      <div style="background:#f9f9fb;border-radius:10px;padding:20px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:6px 0;color:#8e8e93;font-size:13px;width:110px">Date</td>
            <td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${formattedDate}</td>
          </tr>
          ${timeRange ? `<tr>
            <td style="padding:6px 0;color:#8e8e93;font-size:13px">Time</td>
            <td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${timeRange}</td>
          </tr>` : ""}
          ${wr.service_type ? `<tr>
            <td style="padding:6px 0;color:#8e8e93;font-size:13px">Service</td>
            <td style="padding:6px 0;color:#1c1c1e;font-size:14px;font-weight:500">${wr.service_type}</td>
          </tr>` : ""}
          ${wr.notes ? `<tr>
            <td style="padding:6px 0;color:#8e8e93;font-size:13px;vertical-align:top">Notes</td>
            <td style="padding:6px 0;color:#1c1c1e;font-size:14px">${wr.notes}</td>
          </tr>` : ""}
        </table>
      </div>
      <p style="margin:0;color:#8e8e93;font-size:13px;line-height:1.6">You'll receive a follow-up once your request is confirmed. If you have questions, please reply to this email or contact us directly.</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f2f2f7">
      <p style="margin:0;color:#c7c7cc;font-size:12px">Sent via ${portalTitle}</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-tenant-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        organizationId: wr.organization_id,
        to: client.email,
        subject: `Booking Request Received – ${formattedDate}`,
        html,
      }),
    });
  } catch (e) {
    console.error("Booking confirmation email failed:", e);
  }

  return json({ ok: true });
}
