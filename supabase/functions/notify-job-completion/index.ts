import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotifyPayload {
  organizationId: string;
  scheduleEventId: string;
  employeeUserId: string;
  employeeName: string;
  jobTitle: string;
  clientName: string;
  completedAt: string;
  notes: string;
}

interface RecipientInfo {
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: NotifyPayload = await req.json();
    const {
      organizationId,
      scheduleEventId,
      employeeUserId,
      employeeName,
      jobTitle,
      clientName,
      completedAt,
      notes,
    } = payload;

    if (!organizationId || !employeeUserId || !jobTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all admin/owner/manager members of the org with their profile + auth info
    const { data: members, error: membersError } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .in("role", ["owner", "admin", "manager"]);

    if (membersError || !members?.length) {
      return new Response(
        JSON.stringify({ error: "No admin recipients found", details: membersError?.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect recipient details (email from auth.users, phone from profiles)
    const recipients: RecipientInfo[] = [];
    for (const m of members) {
      const [authRes, profileRes] = await Promise.all([
        supabase.auth.admin.getUserById(m.user_id),
        supabase.from("profiles").select("display_name, phone").eq("id", m.user_id).maybeSingle(),
      ]);
      recipients.push({
        userId: m.user_id,
        email: authRes.data.user?.email ?? null,
        phone: profileRes.data?.phone ?? null,
        displayName: profileRes.data?.display_name || authRes.data.user?.email || "Team Member",
      });
    }

    // Fetch org business settings for SMS sender and org name
    const [orgRes, settingsRes] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
      supabase.from("business_settings").select("business_phone, business_name").eq("organization_id", organizationId).maybeSingle(),
    ]);

    const orgName = orgRes.data?.name || settingsRes.data?.business_name || "Your Organization";

    const formattedDate = new Date(completedAt).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });

    const channelsAttempted = { email: false, sms: false, push: false };
    const channelsSucceeded = { email: false, sms: false, push: false };

    // --- EMAIL ---
    const emailRecipients = recipients.filter(r => r.email);
    if (emailRecipients.length > 0) {
      channelsAttempted.email = true;
      try {
        const mailgunKey = Deno.env.get("MAILGUN_API_KEY");
        const mailgunDomain = Deno.env.get("MAILGUN_DOMAIN") || "mg.bizzypro.app";

        if (mailgunKey) {
          const emailHtml = `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
              <div style="background: #1B4D6E; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
                <h2 style="color: #fff; margin: 0; font-size: 18px;">Job Completed</h2>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">${orgName}</p>
              </div>
              <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                <strong>${employeeName}</strong> has completed a job and is awaiting invoice creation.
              </p>
              <div style="background: #f9fafb; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 120px;">Job</td><td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${jobTitle}</td></tr>
                  ${clientName ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Client</td><td style="padding: 6px 0; color: #111827; font-size: 14px;">${clientName}</td></tr>` : ""}
                  <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Completed</td><td style="padding: 6px 0; color: #111827; font-size: 14px;">${formattedDate}</td></tr>
                  <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Employee</td><td style="padding: 6px 0; color: #111827; font-size: 14px;">${employeeName}</td></tr>
                  ${notes ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Notes</td><td style="padding: 6px 0; color: #374151; font-size: 14px;">${notes}</td></tr>` : ""}
                </table>
              </div>
              <p style="color: #6b7280; font-size: 13px;">Log in to Bizzy to create and send the invoice.</p>
            </div>
          `;

          const toList = emailRecipients.map(r => r.email!).join(", ");
          const formData = new FormData();
          formData.append("from", "Bizzy Notifications <notifications@bizzypro.app>");
          formData.append("to", toList);
          formData.append("subject", `Job Completed: ${jobTitle}${clientName ? ` — ${clientName}` : ""}`);
          formData.append("html", emailHtml);

          const mgRes = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
            method: "POST",
            headers: { Authorization: "Basic " + btoa("api:" + mailgunKey) },
            body: formData,
          });

          if (mgRes.ok) channelsSucceeded.email = true;
        }
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    }

    // --- SMS ---
    const smsRecipients = recipients.filter(r => r.phone);
    if (smsRecipients.length > 0) {
      channelsAttempted.sms = true;
      try {
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");

        // Get org's provisioned SMS number
        const { data: smsSettings } = await supabase
          .from("tenant_sms_settings")
          .select("phone_number")
          .eq("organization_id", organizationId)
          .maybeSingle();

        const fromNumber = smsSettings?.phone_number || Deno.env.get("TWILIO_FROM_NUMBER");

        if (twilioSid && twilioToken && fromNumber) {
          const smsBody = `[Bizzy] Job completed by ${employeeName}: "${jobTitle}"${clientName ? ` for ${clientName}` : ""}${notes ? `\nNote: ${notes}` : ""}\nCompleted at ${formattedDate}. Log in to create the invoice.`;

          let anySmsOk = false;
          for (const r of smsRecipients) {
            try {
              const smsRes = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
                {
                  method: "POST",
                  headers: {
                    Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({ To: r.phone!, From: fromNumber, Body: smsBody }),
                }
              );
              if (smsRes.ok) anySmsOk = true;
            } catch {}
          }
          if (anySmsOk) channelsSucceeded.sms = true;
        }
      } catch (smsErr) {
        console.error("SMS send error:", smsErr);
      }
    }

    // --- PUSH ---
    const pushTitle = `Job Completed: ${jobTitle}`;
    const pushBody = `${employeeName} completed "${jobTitle}"${clientName ? ` for ${clientName}` : ""}. Invoice needed.`;

    channelsAttempted.push = true;
    let anyPushOk = false;
    for (const r of recipients) {
      try {
        // Look up active push tokens for this user
        const { data: tokens } = await supabase
          .from("push_tokens")
          .select("token")
          .eq("user_id", r.userId)
          .eq("active", true);

        if (!tokens?.length) continue;

        const messages = tokens.map(t => ({
          to: t.token,
          title: pushTitle,
          body: pushBody,
          sound: "default",
          data: {
            type: "job_completion",
            scheduleEventId,
            employeeUserId,
            organizationId,
          },
          channelId: "default",
        }));

        // Send in batches of 100
        for (let i = 0; i < messages.length; i += 100) {
          const batch = messages.slice(i, i + 100);
          const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(batch),
          });

          if (expoRes.ok) {
            const result = await expoRes.json();
            const tickets = Array.isArray(result.data) ? result.data : [result.data];
            if (tickets.some((t: any) => t?.status === "ok")) anyPushOk = true;

            // Deactivate invalid tokens
            for (let j = 0; j < tickets.length; j++) {
              if (tickets[j]?.details?.error === "DeviceNotRegistered") {
                await supabase
                  .from("push_tokens")
                  .update({ active: false })
                  .eq("token", batch[j].to);
              }
            }
          }
        }

        // Record in push_notifications table
        await supabase.from("push_notifications").insert({
          user_id: r.userId,
          title: pushTitle,
          body: pushBody,
          type: "job_completion",
          data: { scheduleEventId, employeeUserId, organizationId },
          delivered: anyPushOk,
        });
      } catch (pushErr) {
        console.error("Push send error for user", r.userId, pushErr);
      }
    }
    if (anyPushOk) channelsSucceeded.push = true;

    // --- AUDIT LOG ---
    const { error: auditError } = await supabase.from("job_completion_notifications").insert({
      organization_id: organizationId,
      schedule_event_id: scheduleEventId || null,
      employee_user_id: employeeUserId,
      employee_name: employeeName,
      job_title: jobTitle,
      client_name: clientName,
      completed_at: completedAt,
      notes,
      channels_attempted: channelsAttempted,
      channels_succeeded: channelsSucceeded,
    });

    if (auditError) console.error("Audit log insert error:", auditError);

    return new Response(
      JSON.stringify({ success: true, channelsAttempted, channelsSucceeded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notify-job-completion error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
