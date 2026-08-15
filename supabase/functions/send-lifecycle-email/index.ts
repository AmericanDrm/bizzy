import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FEEDBACK_EMAIL = "bizzyapphelp@gmail.com";
const FROM_NAME = "Bizzy";
const FROM_EMAIL = "noreply@bizzypro.app";
const SENDING_DOMAIN = "bizzypro.app";

function getEmailContent(emailType: string, ownerName: string, orgName: string): { subject: string; html: string; text: string } {
  const firstName = ownerName?.split(" ")[0] || "there";

  const feedbackCta = `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#0369a1;">Got feedback?</p>
      <p style="margin:0;color:#374151;">We'd love to hear how Bizzy is working for you. Just reply to this email or reach us at <a href="mailto:${FEEDBACK_EMAIL}" style="color:#0369a1;">${FEEDBACK_EMAIL}</a>.</p>
    </div>`;

  switch (emailType) {
    case "welcome":
      return {
        subject: `Welcome to Bizzy, ${firstName}! Here's how to get started`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="background:#0ea5e9;width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
          <span style="color:#fff;font-size:28px;font-weight:700;">B</span>
        </div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">Welcome to Bizzy, ${firstName}!</h1>
      </div>
      <p style="color:#374151;line-height:1.6;">You've just created <strong>${orgName}</strong> on Bizzy. We're glad you're here.</p>
      <p style="color:#374151;line-height:1.6;">You're on a <strong>14-day free trial</strong> — no credit card required, no limits.</p>
      <h2 style="font-size:16px;font-weight:600;color:#0f172a;margin-top:28px;">Quick wins to get started:</h2>
      <ul style="color:#374151;line-height:1.8;padding-left:20px;">
        <li>Add your first client and schedule a job</li>
        <li>Send an estimate or invoice</li>
        <li>Invite a team member using your org code in Settings</li>
        <li>Set up your time clock</li>
      </ul>
      ${feedbackCta}
      <p style="color:#6b7280;font-size:14px;margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;">
        Questions? Reply to this email or reach us at <a href="mailto:${FEEDBACK_EMAIL}" style="color:#0ea5e9;">${FEEDBACK_EMAIL}</a>.<br>— The Bizzy Team
      </p>
    </div>
  </div>
</body></html>`,
        text: `Welcome to Bizzy, ${firstName}!\n\nYou've just created ${orgName}. You're on a 14-day free trial.\n\nQuick wins:\n- Add your first client\n- Send an estimate or invoice\n- Invite a team member\n\nGot feedback? Reply here or email ${FEEDBACK_EMAIL}.\n\n— The Bizzy Team`,
      };

    case "checkin_3mo":
      return {
        subject: `${firstName}, how's Bizzy treating you? (3-month check-in)`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="background:#0ea5e9;width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
          <span style="color:#fff;font-size:28px;font-weight:700;">B</span>
        </div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">3 months in — nice work!</h1>
      </div>
      <p style="color:#374151;line-height:1.6;">Hi ${firstName},</p>
      <p style="color:#374151;line-height:1.6;">It's been 3 months since <strong>${orgName}</strong> got started on Bizzy. Hope things are running smoother than ever.</p>
      <ul style="color:#374151;line-height:1.8;padding-left:20px;">
        <li><strong>Route optimization</strong> — plan your day efficiently</li>
        <li><strong>Recurring jobs</strong> — set it and forget it for repeat clients</li>
        <li><strong>Client portal</strong> — let clients see their upcoming schedule</li>
        <li><strong>Broadcast messaging</strong> — send updates to all your clients at once</li>
      </ul>
      ${feedbackCta}
      <p style="color:#6b7280;font-size:14px;margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;">Reply anytime or reach us at <a href="mailto:${FEEDBACK_EMAIL}" style="color:#0ea5e9;">${FEEDBACK_EMAIL}</a>.<br>— The Bizzy Team</p>
    </div>
  </div>
</body></html>`,
        text: `Hi ${firstName},\n\nIt's been 3 months since ${orgName} started on Bizzy. Hope things are going well!\n\nHave you tried route optimization, recurring jobs, or the client portal yet?\n\nGot feedback? Reply or email ${FEEDBACK_EMAIL}.\n\n— The Bizzy Team`,
      };

    case "checkin_6mo":
      return {
        subject: `6 months with Bizzy — let's talk about what's working`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="background:#0ea5e9;width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
          <span style="color:#fff;font-size:28px;font-weight:700;">B</span>
        </div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">6 months — you're a pro at this!</h1>
      </div>
      <p style="color:#374151;line-height:1.6;">Hi ${firstName},</p>
      <p style="color:#374151;line-height:1.6;">Half a year running <strong>${orgName}</strong> on Bizzy. That's a real commitment.</p>
      <ul style="color:#374151;line-height:1.8;padding-left:20px;">
        <li>Growing the team (additional users are $22/mo each)</li>
        <li>Upgrading to get GPS tracking and AI job assist</li>
        <li>Exporting reports for taxes and accounting</li>
        <li>Setting up custom email branding so clients see your name</li>
      </ul>
      ${feedbackCta}
      <p style="color:#6b7280;font-size:14px;margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;">Reply anytime or reach us at <a href="mailto:${FEEDBACK_EMAIL}" style="color:#0ea5e9;">${FEEDBACK_EMAIL}</a>.<br>— The Bizzy Team</p>
    </div>
  </div>
</body></html>`,
        text: `Hi ${firstName},\n\nSix months with ${orgName} on Bizzy! Thanks for sticking with us.\n\nThinking about growing your team or upgrading your plan? Additional users are $22/mo each.\n\nGot feedback? Reply or email ${FEEDBACK_EMAIL}.\n\n— The Bizzy Team`,
      };

    case "checkin_11mo14d":
      return {
        subject: `Almost a year with Bizzy — your renewal is coming up`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="background:#0ea5e9;width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
          <span style="color:#fff;font-size:28px;font-weight:700;">B</span>
        </div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">Nearly one year — thank you!</h1>
      </div>
      <p style="color:#374151;line-height:1.6;">Hi ${firstName},</p>
      <p style="color:#374151;line-height:1.6;">Your annual milestone is coming up for <strong>${orgName}</strong>. Your subscription will continue automatically, but if anything isn't right — reply now.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 8px;font-weight:600;color:#15803d;">Thinking about the year ahead?</p>
        <p style="margin:0;color:#374151;">Upgrading could unlock GPS crew tracking, AI job assist, advanced analytics, and more.</p>
      </div>
      ${feedbackCta}
      <p style="color:#6b7280;font-size:14px;margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;">Reply anytime or reach us at <a href="mailto:${FEEDBACK_EMAIL}" style="color:#0ea5e9;">${FEEDBACK_EMAIL}</a>.<br>— The Bizzy Team</p>
    </div>
  </div>
</body></html>`,
        text: `Hi ${firstName},\n\nYour one-year milestone with ${orgName} on Bizzy is almost here. Thank you!\n\nIf anything isn't right with your plan or billing, reply here or email ${FEEDBACK_EMAIL}.\n\n— The Bizzy Team`,
      };

    default:
      return {
        subject: "A message from Bizzy",
        html: `<p>Hi ${firstName}, thanks for using Bizzy.</p>`,
        text: `Hi ${firstName}, thanks for using Bizzy.`,
      };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { lifecycle_email_id } = body;

    if (!lifecycle_email_id) {
      return new Response(JSON.stringify({ error: "lifecycle_email_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: record, error: fetchError } = await supabase
      .from("organization_lifecycle_emails")
      .select("*")
      .eq("id", lifecycle_email_id)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchError || !record) {
      return new Response(JSON.stringify({ error: "Record not found or already processed" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { subject, html, text } = getEmailContent(record.email_type, record.owner_name || "", record.org_name);

    let sent = false;
    let sendError = "";

    if (mailgunApiKey) {
      const form = new FormData();
      form.append("from", `${FROM_NAME} <${FROM_EMAIL}>`);
      form.append("to", record.owner_email);
      form.append("subject", subject);
      form.append("html", html);
      form.append("text", text);
      form.append("h:Reply-To", FEEDBACK_EMAIL);

      const mgRes = await fetch(`https://api.mailgun.net/v3/${SENDING_DOMAIN}/messages`, {
        method: "POST",
        headers: { "Authorization": `Basic ${btoa(`api:${mailgunApiKey}`)}` },
        body: form,
      });

      if (mgRes.ok) {
        sent = true;
      } else {
        sendError = await mgRes.text();
      }
    } else {
      sendError = "No MAILGUN_API_KEY configured";
    }

    await supabase.from("organization_lifecycle_emails").update({
      status: sent ? "sent" : "failed",
      sent_at: sent ? new Date().toISOString() : null,
      error_message: sent ? null : sendError,
    }).eq("id", lifecycle_email_id);

    return new Response(JSON.stringify({ success: sent, error: sent ? null : sendError }), {
      status: sent ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
