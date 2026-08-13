import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { jsonRequest } from "../../shared/printRequest.ts";

// Polls Printful for orders that just shipped and emails each customer a
// shipping confirmation via the connected Gmail account. Dedups by order_id
// using the PrintfulShipment entity so each order is emailed exactly once.
// Invoked by the "Printful Shipment Notifier" scheduled workflow.

const API = "https://api.printful.com";

async function pfGet(path, token, storeId) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (storeId) headers["X-PF-Store-Id"] = String(storeId);
  const r = await jsonRequest({ url: `${API}${path}`, headers });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  const d = r.data || {};
  return { ok: true, result: d.result, paging: d.paging };
}

function base64urlUtf8(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRawMessage(fromEmail, toEmail, toName, subject, body) {
  const to = toName ? `${toName} <${toEmail}>` : toEmail;
  const raw = [
    `From: LOKIN AI <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join("\r\n");
  return base64urlUtf8(raw);
}

async function sendGmail(gmailToken, fromEmail, toEmail, toName, subject, body) {
  const raw = buildRawMessage(fromEmail, toEmail, toName, subject, body);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${gmailToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gmail send failed (${res.status}): ${t}`);
  }
  return res.json();
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const pfToken = secrets.get("PRINTFUL_API_TOKEN");
    if (!pfToken) return Response.json({ error: "PRINTFUL_API_TOKEN not configured" }, { status: 500 });

    // Resolve the Printful store id (first store on the token).
    const storesRes = await pfGet(`/stores`, pfToken, "");
    if (!storesRes.ok) return Response.json({ error: storesRes.error }, { status: storesRes.status });
    const storeId = String(storesRes.result?.[0]?.id || "");
    if (!storeId) return Response.json({ error: "No Printful store found" }, { status: 500 });

    // Gmail connection + sender address.
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection("gmail");
    if (!gmailToken) return Response.json({ error: "Gmail not connected" }, { status: 500 });
    const profRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${gmailToken}` },
    });
    if (!profRes.ok) return Response.json({ error: "Gmail sender lookup failed" }, { status: 500 });
    const fromEmail = (await profRes.json()).email;

    // Gather shipped orders (fulfilled = fully shipped, partial = some packages shipped).
    const statuses = ["fulfilled", "partial"];
    const orders = [];
    for (const status of statuses) {
      const r = await pfGet(`/store/orders?limit=100&status=${status}`, pfToken, storeId);
      if (r.ok && Array.isArray(r.result)) orders.push(...r.result);
    }
    const seen = new Set();
    const unique = orders.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));

    // Skip orders we already notified.
    const existing = await base44.asServiceRole.entities.PrintfulShipment.filter({});
    const notified = new Set((existing || []).map((s) => String(s.order_id)));
    const toNotify = unique.filter((o) => !notified.has(String(o.id)));

    let notifiedCount = 0;
    const errors = [];
    for (const o of toNotify) {
      try {
        const dr = await pfGet(`/store/orders/${encodeURIComponent(o.id)}`, pfToken, storeId);
        if (!dr.ok) { errors.push({ id: o.id, error: dr.error }); continue; }
        const detail = dr.result || {};
        const c = detail.customer || {};
        const email = c.email;
        const name = (c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim()) || "there";
        const shipments = detail.shipments || [];
        if (!email) { errors.push({ id: o.id, error: "no customer email" }); continue; }

        const trackingLines = shipments
          .map((s) => (s.tracking_number ? `${s.carrier || "Carrier"}: ${s.tracking_number}` : (s.carrier || "Shipped")))
          .filter(Boolean);
        const trackingBlock = trackingLines.length
          ? trackingLines.map((l) => `• ${l}`).join("\n")
          : "Your package is on the way — tracking will update soon.";

        const subject = `Your LOKIN order has shipped`;
        const body =
          `Hi ${name},\n\n` +
          `Good news — your LOKIN order (#${o.id}) has shipped!\n\n` +
          `Tracking:\n${trackingBlock}\n\n` +
          `Thank you for supporting LOKIN AI.\n\n` +
          `— LOKIN AI`;

        await sendGmail(gmailToken, fromEmail, email, name, subject, body);
        await base44.asServiceRole.entities.PrintfulShipment.create({
          order_id: String(o.id),
          customer_email: email,
          customer_name: name,
          tracking: shipments.map((s) => s.tracking_number).filter(Boolean).join(", "),
          carrier: shipments.map((s) => s.carrier).filter(Boolean).join(", "),
          shipped_at: new Date().toISOString(),
        });
        notifiedCount++;
      } catch (e) {
        errors.push({ id: o.id, error: e.message });
      }
    }

    return Response.json({
      notified: notifiedCount,
      candidates: toNotify.length,
      scanned: unique.length,
      errors,
    });
  } catch (error) {
    console.error("printful-shipped-notifier error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}