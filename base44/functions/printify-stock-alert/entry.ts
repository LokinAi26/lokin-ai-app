import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { jsonRequest } from "../../shared/printRequest.ts";
import { getGmailSender, gmailSendMessage } from "../../shared/gmailSend.ts";

// Daily Printify stock scanner — alerts the app owner when branded items
// drop below their configured enabled-variant threshold. Invoked by the
// "Printify Stock Alert" scheduled workflow (daily 9am local) and runnable
// on-demand from the Settings Stock Alert setup card.
//
// "Low" = enabled variant count below threshold; "Out" = 0 enabled variants.
// Secret: PRINTIFY_API_TOKEN. Email: connected Gmail connector (gmail.send).

const API = "https://api.printify.com/v1";

async function pfyGet(path, token) {
  const r = await jsonRequest({ url: `${API}${path}`, headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, data: r.data };
}

async function resolveRecipientEmail(base44, pref) {
  if (pref.stock_alert_email) return pref.stock_alert_email;
  try {
    const u = await base44.asServiceRole.entities.User.filter({ id: pref.created_by_id });
    return u?.[0]?.email || "";
  } catch {
    return "";
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const token = secrets.get("PRINTIFY_API_TOKEN");
    if (!token) return Response.json({ error: "PRINTIFY_API_TOKEN not configured" }, { status: 500 });

    // Collect every owner who opted into daily stock alerts
    const prefs = await base44.asServiceRole.entities.DriverPreference.filter({ stock_alert_enabled: true });
    if (!prefs.length) return Response.json({ scanned: false, reason: "No subscribers enabled", recipients: 0 });

    // Resolve Printify shop
    const shopsRes = await pfyGet(`/shops.json`, token);
    if (!shopsRes.ok) return Response.json({ error: shopsRes.error }, { status: shopsRes.status });
    const shopId = String(shopsRes.data?.[0]?.id || "");
    if (!shopId) return Response.json({ error: "No Printify shop found" }, { status: 500 });

    // Paginate the product list
    const collected = [];
    let page = 1;
    while (collected.length < 200) {
      const r = await pfyGet(`/shops/${encodeURIComponent(shopId)}/products.json?page=${page}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const batch = Array.isArray(r.data) ? r.data : [];
      collected.push(...batch);
      if (batch.length === 0) break;
      page += 1;
      if (page > 50) break;
    }

    // Per product: count enabled variants (availability proxy)
    const products = [];
    await Promise.all(
      collected.slice(0, 200).map(async (p) => {
        const r = await pfyGet(`/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(p.id)}.json`, token);
        if (!r.ok) return;
        const d = r.data || {};
        const variants = d.variants || [];
        const enabled = variants.filter((v) => v.is_enabled).length;
        products.push({ title: d.title, enabled, total: variants.length });
      })
    );

    // Gmail sender
    const { token: gmailToken, fromEmail } = await getGmailSender(base44);
    if (!gmailToken) return Response.json({ scanned: true, shopId, productsScanned: products.length, emailed: 0, reason: "Gmail not connected" });

    let emailed = 0;
    const alerts = [];
    for (const pref of prefs) {
      const threshold = Number(pref.stock_alert_threshold) || 5;
      const lowItems = products
        .filter((f) => f.enabled < threshold)
        .map((f) => ({
          title: f.title,
          enabled: f.enabled,
          total: f.total,
          status: f.enabled === 0 ? "OUT OF STOCK" : "LOW",
        }));
      if (!lowItems.length) continue;

      const toEmail = await resolveRecipientEmail(base44, pref);
      if (!toEmail) continue;

      const lines = lowItems.map((f) => `• ${f.title} — ${f.enabled}/${f.total} variants (${f.status})`).join("\n");
      const subject = `LOKIN Brand — ${lowItems.length} item${lowItems.length === 1 ? "" : "s"} running low`;
      const body =
        `Your daily Printify stock scan found ${lowItems.length} branded item${lowItems.length === 1 ? "" : "s"} below your threshold of ${threshold} enabled variants:\n\n` +
        `${lines}\n\n` +
        `Restock or re-enable variants in your Printify dashboard to keep the LOKIN store live.\n\n` +
        `— LOKIN AI`;
      try {
        await gmailSendMessage(gmailToken, fromEmail, toEmail, "", subject, body);
        emailed++;
        alerts.push({ to: toEmail, count: lowItems.length });
      } catch (e) {
        console.error("stock alert email failed:", e.message);
      }
    }

    return Response.json({ scanned: true, shopId, productsScanned: products.length, recipients: emailed, alerts });
  } catch (error) {
    console.error("printify-stock-alert error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}