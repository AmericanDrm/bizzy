import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

function esc(s: string): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

async function lookupEstimate(token: string) {
  const supabase = getSupabase();

  const { data: tokenRow, error: tokenErr } = await supabase
    .from("estimate_approval_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (tokenErr || !tokenRow) return { error: "Invalid or expired link." };
  if (tokenRow.used_at) return { error: "This estimate has already been approved." };
  if (new Date(tokenRow.expires_at) < new Date())
    return { error: "This approval link has expired." };

  const { data: estimate, error: estErr } = await supabase
    .from("estimates")
    .select("*, estimate_items(*)")
    .eq("id", tokenRow.estimate_id)
    .maybeSingle();

  if (estErr || !estimate) return { error: "Estimate not found." };

  if (estimate.status === "approved")
    return { error: "This estimate has already been approved." };

  const { data: client } = await supabase
    .from("clients")
    .select("name, email")
    .eq("id", estimate.client_id)
    .maybeSingle();

  const { data: biz } = await supabase
    .from("business_settings")
    .select("business_name, business_phone, business_email, logo_url")
    .eq("organization_id", estimate.organization_id)
    .maybeSingle();

  return { tokenRow, estimate, client, business: biz };
}

async function handleApproval(token: string, body: any) {
  const supabase = getSupabase();

  const { data: tokenRow } = await supabase
    .from("estimate_approval_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return { error: "Invalid, used, or expired token." };
  }

  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, estimate_items(*)")
    .eq("id", tokenRow.estimate_id)
    .maybeSingle();

  if (!estimate || estimate.status === "approved") {
    return { error: "Estimate not found or already approved." };
  }

  const approvedItemIds: string[] = body.approvedItemIds || [];
  const signatureData: string = body.signatureData || "";
  const signedByName: string = body.signedByName || "";
  const signedByEmail: string = body.signedByEmail || "";
  const clientNotes: string = body.clientNotes || "";

  if (estimate.requires_signature && !signatureData) {
    return { error: "Signature is required." };
  }

  const items = estimate.estimate_items || [];
  let approvedSubtotal = 0;

  for (const item of items) {
    const isApproved = !item.is_optional || approvedItemIds.includes(item.id);
    approvedSubtotal += isApproved ? Number(item.total) : 0;

    const { error: itemErr } = await supabase
      .from("estimate_items")
      .update({ approved_by_client: isApproved })
      .eq("id", item.id);

    if (itemErr) {
      console.error("Failed to update item:", itemErr);
    }
  }

  let discountAmount = Number(estimate.discount_amount) || 0;
  if (Number(estimate.discount_percentage) > 0) {
    discountAmount = (approvedSubtotal * Number(estimate.discount_percentage)) / 100;
  }
  const afterDiscount = Math.max(0, approvedSubtotal - discountAmount);
  const taxAmount = (afterDiscount * Number(estimate.tax_rate)) / 100;
  const total = afterDiscount + taxAmount;

  const { error: updateErr } = await supabase
    .from("estimates")
    .update({
      status: "approved",
      signed_at: new Date().toISOString(),
      signature_data: signatureData || null,
      signed_by_name: signedByName.trim(),
      signed_by_email: signedByEmail.trim(),
      client_notes: clientNotes.trim(),
      subtotal: approvedSubtotal,
      tax_amount: taxAmount,
      total: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRow.estimate_id);

  if (updateErr) {
    console.error("Failed to update estimate:", updateErr);
    return { error: "Failed to update estimate. Please try again." };
  }

  const { error: tokenMarkErr } = await supabase
    .from("estimate_approval_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  if (tokenMarkErr) {
    console.error("Failed to mark token as used:", tokenMarkErr);
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", estimate.client_id)
    .maybeSingle();

  const jobTitle = `${client?.name || "Client"} - Job from Estimate #${estimate.estimate_number}`;

  const { error: jobErr } = await supabase
    .from("jobs")
    .insert({
      organization_id: estimate.organization_id,
      user_id: estimate.user_id,
      client_id: estimate.client_id,
      title: jobTitle,
      description: `Auto-created from approved estimate #${estimate.estimate_number}`,
      date: new Date().toISOString().split("T")[0],
      status: "pending",
      priority: "medium",
      crew_size: 1,
      amount: total,
      estimate_id: tokenRow.estimate_id,
    });

  if (jobErr) {
    console.error("Failed to auto-create job:", jobErr);
  }

  return { success: true };
}

function renderErrorPage(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estimate</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;background:#f5f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:16px;padding:48px;max-width:480px;text-align:center;box-shadow:0 2px 20px rgba(0,0,0,.08)}
h2{margin:0 0 12px;color:#1d1d1f}p{color:#86868b;line-height:1.5}
</style></head><body><div class="card"><h2>Unable to Load Estimate</h2><p>${message}</p></div></body></html>`;
}

function renderSuccessPage(businessName: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estimate Approved</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;background:#f5f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:16px;padding:48px;max-width:480px;text-align:center;box-shadow:0 2px 20px rgba(0,0,0,.08)}
h2{margin:0 0 12px;color:#1d1d1f}.check{font-size:64px;margin-bottom:16px;color:#34c759}p{color:#86868b;line-height:1.5}
</style></head><body><div class="card"><div class="check">✓</div><h2>Estimate Approved!</h2><p>Thank you! Your approval has been submitted to ${esc(businessName)}. They will be in touch to schedule your service.</p></div></body></html>`;
}

function renderApprovalPage(estimate: any, items: any[], client: any, business: any, token: string) {
  const bizName = business?.business_name || "the provider";
  const logoUrl = business?.logo_url || "";
  const clientName = client?.name || "";
  const clientEmail = client?.email || "";
  const requiresSig = estimate.requires_signature;

  const sortedItems = [...items].sort(
    (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
  );

  const itemsHtml = sortedItems
    .map((item: any) => {
      const isOptional = item.is_optional;
      const itemDiscount = Number(item.discount_amount) || 0;
      const itemDiscountPct = Number(item.discount_percentage) || 0;
      let lineTotal = Number(item.total) || 0;
      let discountLabel = "";
      if (itemDiscount > 0) discountLabel = ` <span class="discount">(-${fmt(itemDiscount)} discount)</span>`;
      if (itemDiscountPct > 0) discountLabel = ` <span class="discount">(-${itemDiscountPct}% discount)</span>`;

      return `<div class="line-item ${isOptional ? "optional" : ""}" data-id="${item.id}" data-total="${lineTotal}" data-optional="${isOptional}">
  <div class="item-left">
    ${isOptional ? `<label class="toggle"><input type="checkbox" checked onchange="recalc()"><span class="slider"></span></label>` : `<div class="included-badge">Included</div>`}
    <div class="item-info">
      <div class="item-desc">${esc(item.description)}${isOptional ? ' <span class="opt-tag">Optional</span>' : ""}${discountLabel}</div>
      ${item.notes ? `<div class="item-notes">${esc(item.notes)}</div>` : ""}
    </div>
  </div>
  <div class="item-right">
    <span class="qty">${item.quantity || 1} × ${fmt(item.unit_price)}</span>
    <span class="line-total">${fmt(lineTotal)}</span>
  </div>
</div>`;
    })
    .join("");

  const discountAmt = Number(estimate.discount_amount) || 0;
  const discountPct = Number(estimate.discount_percentage) || 0;
  const taxRate = Number(estimate.tax_rate) || 0;
  const validDate = new Date(estimate.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const issueDate = new Date(estimate.issue_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estimate #${esc(estimate.estimate_number)} - Review &amp; Approve</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;color:#1d1d1f;line-height:1.5}
.page{max-width:700px;margin:0 auto;padding:24px 16px 48px}
.header{background:linear-gradient(135deg,#1a3c5e,#0f2942);color:#fff;border-radius:16px;padding:32px;margin-bottom:24px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.1)}
${logoUrl ? `.logo{max-width:140px;max-height:50px;margin-bottom:12px}` : ""}
.header h1{font-size:20px;font-weight:600;margin-bottom:4px;opacity:.95}
.header .est-num{opacity:.8;font-size:14px;margin-top:4px}
.header .biz{font-size:26px;font-weight:700;margin-bottom:8px;letter-spacing:.5px}
.card{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 1px 8px rgba(0,0,0,.06)}
.card h2{font-size:16px;font-weight:600;margin-bottom:16px;color:#1d1d1f}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.meta-item{font-size:13px}.meta-label{color:#86868b;margin-bottom:2px}.meta-value{font-weight:600}
.line-item{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid #f0f0f0;transition:opacity .2s}
.line-item:last-child{border-bottom:none}
.item-left{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
.item-right{text-align:right;flex-shrink:0;margin-left:12px}
.item-desc{font-weight:500;font-size:14px}.item-notes{font-size:12px;color:#86868b;margin-top:2px}
.qty{font-size:12px;color:#86868b;display:block;margin-bottom:2px}.line-total{font-weight:600;font-size:15px}
.opt-tag{background:#e8f4fd;color:#0071e3;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:500}
.discount{color:#34c759;font-size:12px}
.included-badge{background:#f0f0f0;color:#86868b;font-size:11px;padding:4px 10px;border-radius:8px;font-weight:500;white-space:nowrap}
.toggle{position:relative;width:44px;height:24px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#ccc;border-radius:24px;transition:.3s}
.slider:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s}
.toggle input:checked+.slider{background:#0071e3}
.toggle input:checked+.slider:before{transform:translateX(20px)}
.totals{margin-top:16px;border-top:1px solid #f0f0f0;padding-top:16px}
.total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:14px}
.total-row.grand{font-size:18px;font-weight:700;border-top:2px solid #1d1d1f;margin-top:8px;padding-top:12px;color:#1a3c5e}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;font-weight:600;color:#86868b;margin-bottom:6px}
.form-group input,.form-group textarea{width:100%;padding:12px;border:1px solid #d2d2d7;border-radius:10px;font-size:15px;font-family:inherit;transition:border-color .2s}
.form-group input:focus,.form-group textarea:focus{outline:none;border-color:#0071e3}
.form-group textarea{resize:vertical;min-height:80px}
.sig-area{border:2px dashed #d2d2d7;border-radius:12px;background:#fafafa;position:relative;margin-bottom:8px;touch-action:none}
.sig-area canvas{display:block;border-radius:10px;width:100%;cursor:crosshair}
.sig-actions{display:flex;gap:8px;justify-content:flex-end}
.sig-actions button{background:none;border:1px solid #d2d2d7;border-radius:8px;padding:6px 16px;font-size:13px;cursor:pointer;color:#86868b;transition:all .2s}
.sig-actions button:hover{border-color:#0071e3;color:#0071e3}
.btn-approve{width:100%;padding:16px;background:#0071e3;color:#fff;border:none;border-radius:14px;font-size:17px;font-weight:600;cursor:pointer;transition:background .2s}
.btn-approve:hover{background:#0056b3}
.btn-approve:disabled{background:#d2d2d7;cursor:not-allowed}
.btn-decline{width:100%;padding:14px;background:none;border:1px solid #d2d2d7;border-radius:14px;font-size:15px;color:#86868b;cursor:pointer;margin-top:10px;transition:all .2s}
.btn-decline:hover{border-color:#ff3b30;color:#ff3b30}
.error-msg{background:#fff2f2;color:#ff3b30;padding:12px;border-radius:10px;font-size:14px;margin-bottom:16px;display:none}
.valid-until{background:#fff8e8;color:#a68307;padding:10px 16px;border-radius:10px;font-size:13px;text-align:center;margin-top:16px;border:1px solid #fde68a}
@media(max-width:480px){.meta-grid{grid-template-columns:1fr}.page{padding:16px 12px 32px}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(bizName)}" class="logo" />` : ""}
    <div class="biz">${esc(bizName)}</div>
    <h1>Estimate for Your Review</h1>
    <div class="est-num">#${esc(estimate.estimate_number)}</div>
  </div>

  <div class="card">
    <h2>Estimate Details</h2>
    <div class="meta-grid">
      <div class="meta-item"><div class="meta-label">Issue Date</div><div class="meta-value">${issueDate}</div></div>
      <div class="meta-item"><div class="meta-label">Valid Until</div><div class="meta-value">${validDate}</div></div>
    </div>
    ${estimate.notes ? `<div style="padding:12px;background:#f9f9fb;border-radius:10px;font-size:13px;color:#515154"><strong>Notes:</strong> ${esc(estimate.notes)}</div>` : ""}
  </div>

  <div class="card">
    <h2>Services${sortedItems.some((i: any) => i.is_optional) ? ' <span style="font-weight:400;font-size:13px;color:#86868b">- Toggle optional items</span>' : ""}</h2>
    <div id="items-list">${itemsHtml}</div>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span id="subtotal">${fmt(0)}</span></div>
      ${discountAmt > 0 ? `<div class="total-row"><span>Discount</span><span>-${fmt(discountAmt)}</span></div>` : ""}
      ${discountPct > 0 ? `<div class="total-row"><span>Discount (${discountPct}%)</span><span id="discount-val">-${fmt(0)}</span></div>` : ""}
      ${taxRate > 0 ? `<div class="total-row"><span>Tax (${taxRate}%)</span><span id="tax-val">${fmt(0)}</span></div>` : ""}
      <div class="total-row grand"><span>Total</span><span id="grand-total">${fmt(0)}</span></div>
    </div>
    <div class="valid-until">This estimate is valid until ${validDate}</div>
  </div>

  <div class="card">
    <h2>Your Information</h2>
    <div id="error-msg" class="error-msg"></div>
    <div class="form-group">
      <label>Full Name *</label>
      <input type="text" id="client-name" value="${esc(clientName)}" placeholder="Your full name" required>
    </div>
    <div class="form-group">
      <label>Email Address *</label>
      <input type="email" id="client-email" value="${esc(clientEmail)}" placeholder="your@email.com" required>
    </div>
    <div class="form-group">
      <label>Notes or Questions (optional)</label>
      <textarea id="client-notes" placeholder="Any questions or special requests..."></textarea>
    </div>
  </div>

  ${requiresSig ? `<div class="card">
    <h2>Signature *</h2>
    <p style="font-size:13px;color:#86868b;margin-bottom:12px">Please sign below to approve this estimate</p>
    <div class="sig-area" id="sig-area">
      <canvas id="sig-canvas" height="160"></canvas>
    </div>
    <div class="sig-actions">
      <button onclick="clearSig()">Clear Signature</button>
    </div>
  </div>` : ""}

  <div class="card" style="background:transparent;box-shadow:none;padding:0">
    <button class="btn-approve" id="btn-approve" onclick="submitApproval()">Approve &amp; Sign Estimate</button>
    <button class="btn-decline" onclick="submitDecline()">Decline Estimate</button>
  </div>
</div>

<script>
var TOKEN = "${token}";
var DISCOUNT_AMT = ${discountAmt};
var DISCOUNT_PCT = ${discountPct};
var TAX_RATE = ${taxRate};

function recalc() {
  var items = document.querySelectorAll('.line-item');
  var sub = 0;
  items.forEach(function(el) {
    var isOpt = el.getAttribute('data-optional') === 'true';
    var total = parseFloat(el.getAttribute('data-total'));
    var cb = el.querySelector('input[type=checkbox]');
    if (isOpt && cb && !cb.checked) { el.style.opacity = '0.4'; return; }
    el.style.opacity = '1';
    sub += total;
  });
  document.getElementById('subtotal').textContent = '${fmt(0)}'.replace(/\\d+\\.\\d+/, sub.toFixed(2));
  var disc = DISCOUNT_AMT;
  if (DISCOUNT_PCT > 0) {
    disc = sub * DISCOUNT_PCT / 100;
    var dv = document.getElementById('discount-val');
    if (dv) dv.textContent = '-${fmt(0)}'.replace(/\\d+\\.\\d+/, disc.toFixed(2));
  }
  var afterDisc = sub - disc;
  var tax = afterDisc * TAX_RATE / 100;
  var tv = document.getElementById('tax-val');
  if (tv) tv.textContent = '${fmt(0)}'.replace(/\\d+\\.\\d+/, tax.toFixed(2));
  document.getElementById('grand-total').textContent = '${fmt(0)}'.replace(/\\d+\\.\\d+/, (afterDisc + tax).toFixed(2));
}
recalc();

var canvas, ctx, drawing = false, hasDrawn = false;
${requiresSig ? `
canvas = document.getElementById('sig-canvas');
ctx = canvas.getContext('2d');
function resizeCanvas() {
  var area = document.getElementById('sig-area');
  canvas.width = area.offsetWidth;
  canvas.height = 160;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function getPos(e) {
  var r = canvas.getBoundingClientRect();
  var t = e.touches ? e.touches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}
canvas.addEventListener('mousedown', function(e) { drawing = true; var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
canvas.addEventListener('mousemove', function(e) { if (!drawing) return; hasDrawn = true; var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#1d1d1f'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); });
canvas.addEventListener('mouseup', function() { drawing = false; });
canvas.addEventListener('mouseleave', function() { drawing = false; });
canvas.addEventListener('touchstart', function(e) { e.preventDefault(); drawing = true; var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, {passive:false});
canvas.addEventListener('touchmove', function(e) { e.preventDefault(); if (!drawing) return; hasDrawn = true; var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#1d1d1f'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); }, {passive:false});
canvas.addEventListener('touchend', function() { drawing = false; });
` : ""}

function clearSig() {
  if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); hasDrawn = false; }
}

function showError(msg) {
  var el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getApprovedItemIds() {
  var ids = [];
  document.querySelectorAll('.line-item').forEach(function(el) {
    var isOpt = el.getAttribute('data-optional') === 'true';
    if (!isOpt) {
      ids.push(el.getAttribute('data-id'));
      return;
    }
    var cb = el.querySelector('input[type=checkbox]');
    if (cb && cb.checked) ids.push(el.getAttribute('data-id'));
  });
  return ids;
}

function submitApproval() {
  var name = document.getElementById('client-name').value.trim();
  var email = document.getElementById('client-email').value.trim();
  if (!name) { showError('Please enter your name.'); return; }
  if (!email) { showError('Please enter your email.'); return; }
  ${requiresSig ? `if (!hasDrawn) { showError('Please provide your signature.'); return; }` : ""}

  var btn = document.getElementById('btn-approve');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  var payload = {
    token: TOKEN,
    action: 'approve',
    approvedItemIds: getApprovedItemIds(),
    signedByName: name,
    signedByEmail: email,
    clientNotes: document.getElementById('client-notes').value.trim(),
    signatureData: ${requiresSig ? `canvas.toDataURL('image/png')` : `""`}
  };

  fetch(window.location.pathname + window.location.search, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success) {
      document.body.innerHTML = data.html;
    } else {
      showError(data.error || 'Something went wrong.');
      btn.disabled = false;
      btn.textContent = 'Approve & Sign Estimate';
    }
  })
  .catch(function() {
    showError('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Approve & Sign Estimate';
  });
}

function submitDecline() {
  if (!confirm('Are you sure you want to decline this estimate?')) return;
  fetch(window.location.pathname + window.location.search, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, action: 'decline', clientNotes: document.getElementById('client-notes').value.trim() })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif;background:#f5f5f7"><div style="background:#fff;border-radius:16px;padding:48px;max-width:480px;text-align:center;box-shadow:0 2px 20px rgba(0,0,0,.08)"><h2 style="margin-bottom:12px">Estimate Declined</h2><p style="color:#86868b">The provider has been notified. If you change your mind, please contact them directly.</p></div></div>';
    } else {
      showError(data.error || 'Something went wrong.');
    }
  })
  .catch(function() { showError('Network error.'); });
}
</script>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    if (req.method === "GET") {
      if (!token) {
        return htmlResponse(renderErrorPage("No approval token provided."));
      }

      const result = await lookupEstimate(token);
      if (result.error) {
        return htmlResponse(renderErrorPage(result.error));
      }

      const html = renderApprovalPage(
        result.estimate,
        result.estimate.estimate_items || [],
        result.client,
        result.business,
        token
      );

      return htmlResponse(html);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const postToken = body.token || token;

      if (!postToken) {
        return jsonResponse({ success: false, error: "Missing token." }, 400);
      }

      if (body.action === "decline") {
        const supabase = getSupabase();
        const { data: tokenRow } = await supabase
          .from("estimate_approval_tokens")
          .select("*")
          .eq("token", postToken)
          .maybeSingle();

        if (tokenRow && !tokenRow.used_at) {
          await supabase
            .from("estimates")
            .update({
              status: "declined",
              client_notes: body.clientNotes || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", tokenRow.estimate_id);

          await supabase
            .from("estimate_approval_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("id", tokenRow.id);
        }

        return jsonResponse({ success: true });
      }

      const result = await handleApproval(postToken, body);
      if (result.error) {
        return jsonResponse({ success: false, error: result.error }, 400);
      }

      const { data: tokenRow } = await getSupabase()
        .from("estimate_approval_tokens")
        .select("estimate_id")
        .eq("token", postToken)
        .maybeSingle();

      let bizName = "the provider";
      if (tokenRow) {
        const { data: est } = await getSupabase()
          .from("estimates")
          .select("organization_id")
          .eq("id", tokenRow.estimate_id)
          .maybeSingle();
        if (est) {
          const { data: biz } = await getSupabase()
            .from("business_settings")
            .select("business_name")
            .eq("organization_id", est.organization_id)
            .maybeSingle();
          if (biz?.business_name) bizName = biz.business_name;
        }
      }

      return jsonResponse({ success: true, html: renderSuccessPage(bizName) });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("Error:", error);
    return htmlResponse(
      renderErrorPage("An unexpected error occurred. Please try again later."),
      500
    );
  }
});
