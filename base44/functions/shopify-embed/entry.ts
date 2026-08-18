import { secrets } from "base44:runtime";
import { getShopifyAdminToken } from "../../shared/shopifyAuth.ts";
import { verifyShopifyHmac } from "../../shared/shopifyHmac.ts";
import { verifyShopifySession } from "../../shared/shopifyJwt.ts";
import { shopifyAdminBase, shoGet, mapStorefront, mapOrdersRich, mapDrafts } from "../../shared/shopifyReads.ts";

/**
 * shopify-embed — Public, iframe-safe Shopify storefront for the LOKIN Commerce
 * embedded app running inside the Shopify Admin.
 *
 * Unlike shopify-catalog (which requires an authenticated Base44 user), this
 * function runs with NO Base44 user so it can render inside the Shopify iframe
 * where Base44 auth cannot run. It uses the server-side Shopify credentials
 * (SHOPIFY_STORE_DOMAIN + SHOPIFY_ACCESS_TOKEN / client-credentials) and
 * authenticates Shopify-originated requests via HMAC verification.
 *
 *   storefront / health  -> open (store catalog is semi-public)
 *   orders / order       -> require a valid Shopify HMAC (sensitive data)
 *
 * Actions (payload.action):
 *   health      shopify connection status + HMAC authenticity flag
 *   storefront  shop info + enriched product catalog (one round-trip)
 *   orders      recent orders (HMAC-gated)
 *   order       single order by id (HMAC-gated)
 *
 * Frontend passes the raw Shopify URL params in payload.params so HMAC can be
 * verified server-side with SHOPIFY_CLIENT_SECRET.
 */
const VALID_ACTIONS = ["health", "storefront", "orders", "order", "drafts", "draft", "createDraft", "updateDraft", "sendInvoice", "completeDraft", "draftAI", "intelligence", "fulfillOrder"];

async function shoPost(path: string, body: any, token: string) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await r.json(); } catch { data = null; }
  if (!r.ok) return { ok: false as const, status: r.status, error: data?.error?.message || data?.errors || `Request failed (${r.status})` };
  return { ok: true as const, data };
}

async function shoPut(path: string, body: any, token: string) {
  const r = await fetch(path, {
    method: "PUT",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await r.json(); } catch { data = null; }
  if (!r.ok) return { ok: false as const, status: r.status, error: data?.error?.message || data?.errors || `Request failed (${r.status})` };
  return { ok: true as const, data };
}

function safeDraftLineItems(items: any[]) {
  return (Array.isArray(items) ? items : [])
    .map((it: any) => ({
      ...(it.id ? { id: Number(it.id) } : {}),
      ...(it.variant_id ? { variant_id: Number(it.variant_id) } : {}),
      ...(!it.variant_id && it.title ? { title: String(it.title).slice(0, 180) } : {}),
      quantity: Math.max(1, Math.min(100, Number(it.quantity) || 1)),
      ...(!it.variant_id && it.price != null ? { price: String(it.price) } : {}),
    }))
    .filter((it: any) => it.id || it.variant_id || it.title);
}

function draftForAI(d: any) {
  return {
    id: d?.id,
    name: d?.name,
    status: d?.status,
    created_at: d?.created_at,
    currency: d?.currency,
    total_price: d?.total_price,
    subtotal_price: d?.subtotal_price,
    total_tax: d?.total_tax,
    email: d?.email || d?.customer?.email || "",
    customer: d?.customer ? {
      first_name: d.customer.first_name || "",
      last_name: d.customer.last_name || "",
      email: d.customer.email || "",
    } : null,
    note: d?.note || "",
    line_items: (d?.line_items || []).slice(0, 30).map((it: any) => ({
      title: it.title,
      variant_title: it.variant_title,
      quantity: it.quantity,
      price: it.price,
      sku: it.sku,
    })),
    applied_discount: d?.applied_discount || null,
    shipping_line: d?.shipping_line || null,
  };
}

function buildOrderAggregate(orders: any[], products: any[]) {
  const order_count = orders.length;
  const total_revenue = orders.reduce((s: number, o: any) => s + Number(o.total_price || 0), 0);
  const aov = order_count ? total_revenue / order_count : 0;
  const paid = orders.filter((o: any) => ["paid", "partially_refunded"].includes(o.financial_status)).length;
  const unfulfilled = orders.filter((o: any) => !o.fulfillment_status || o.fulfillment_status === "null").length;
  const fulfilled = orders.filter((o: any) => o.fulfillment_status === "fulfilled").length;
  const partial = orders.filter((o: any) => o.fulfillment_status === "partial").length;
  const refunded = orders.filter((o: any) => ["refunded", "voided"].includes(o.financial_status)).length;
  const byDay: Record<string, number> = {};
  orders.forEach((o: any) => {
    const d = String(o.created_at || "").slice(0, 10);
    if (!d) return;
    byDay[d] = (byDay[d] || 0) + Number(o.total_price || 0);
  });
  const daily_revenue: { date: string; revenue: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(today.getTime() - i * 86400000);
    const key = dt.toISOString().slice(0, 10);
    daily_revenue.push({ date: key, revenue: Number((byDay[key] || 0).toFixed(2)) });
  }
  const prodMap: Record<string, any> = {};
  orders.forEach((o: any) => {
    (o.line_items || []).forEach((it: any) => {
      const key = String(it.product_id || it.title);
      if (!prodMap[key]) prodMap[key] = { title: it.title, units: 0, revenue: 0 };
      prodMap[key].units += Number(it.quantity || 0);
      prodMap[key].revenue += Number(it.quantity || 0) * Number(it.price || 0);
    });
  });
  const top_products = Object.values(prodMap).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 10);
  const custMap: Record<string, any> = {};
  orders.forEach((o: any) => {
    const c = o.customer;
    if (!c) return;
    const key = String(c.email || c.id || "");
    if (!key) return;
    if (!custMap[key]) custMap[key] = { name: c.name || key, email: c.email || "", orders: 0, spend: 0 };
    custMap[key].orders += 1;
    custMap[key].spend += Number(o.total_price || 0);
  });
  const customers = Object.values(custMap);
  const top_customers = customers.sort((a: any, b: any) => b.spend - a.spend).slice(0, 10);
  const repeat_customers = customers.filter((c: any) => c.orders > 1).length;
  const variants: any[] = [];
  products.forEach((p: any) => (p.variants || []).forEach((v: any) => variants.push({ ...v, product_title: p.title, status: p.status })));
  const low_stock = variants.filter((v: any) => v.available != null && v.available > 0 && v.available <= 5).slice(0, 10);
  const out_of_stock = variants.filter((v: any) => v.available === 0).slice(0, 10);
  return {
    order_count,
    total_revenue: Number(total_revenue.toFixed(2)),
    aov: Number(aov.toFixed(2)),
    paid, unfulfilled, fulfilled, partial, refunded,
    customer_count: customers.length,
    repeat_customers,
    daily_revenue,
    top_products,
    top_customers,
    low_stock: low_stock.map((v) => ({ title: v.product_title, available: v.available, sku: v.sku })),
    out_of_stock: out_of_stock.map((v) => ({ title: v.product_title, sku: v.sku })),
    best_sellers: top_products.slice(0, 5),
  };
}

function localIntelligence(agg: any) {
  const avgDaily = agg.daily_revenue.reduce((s: number, d: any) => s + d.revenue, 0) / Math.max(1, agg.daily_revenue.length);
  const repeat_rate = agg.customer_count ? agg.repeat_customers / agg.customer_count : 0;
  const avgOrders = agg.customer_count ? agg.order_count / agg.customer_count : 0;
  const revenue_health = Math.min(100, Math.round(agg.total_revenue / 50));
  const fulfillment_health = agg.order_count ? Math.round((agg.fulfilled / agg.order_count) * 100) : 0;
  const customer_health = Math.min(100, Math.round(repeat_rate * 200));
  const inventory_health = Math.max(0, 100 - Math.min(100, (agg.out_of_stock.length + agg.low_stock.length) * 8));
  const risk = Math.min(100, agg.refunded * 10 + agg.unfulfilled * 3);
  const score = Math.max(0, Math.min(100, Math.round(revenue_health * 0.3 + fulfillment_health * 0.25 + customer_health * 0.2 + inventory_health * 0.15 + (100 - risk) * 0.1)));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  return {
    commerce_intelligence_score: { score, grade, breakdown: { revenue_health, fulfillment_health, customer_health, inventory_health, risk: 100 - risk } },
    insights: [
      { type: "revenue", title: `${agg.order_count} orders confirmed`, detail: `Total ${agg.total_revenue} across ${agg.customer_count} customers; AOV ${agg.aov}.`, severity: "low" },
      ...(agg.unfulfilled > 0 ? [{ type: "fulfillment", title: `${agg.unfulfilled} unfulfilled orders`, detail: "Fulfill pending orders to protect customer experience.", severity: "medium" }] : []),
      ...(agg.out_of_stock.length ? [{ type: "inventory", title: `${agg.out_of_stock.length} out-of-stock`, detail: "Restock or mark unavailable to avoid overselling.", severity: "high" }] : []),
    ],
    revenue_forecast: { next_7_days: Number((avgDaily * 7).toFixed(2)), next_30_days: Number((avgDaily * 30).toFixed(2)), confidence: "low", trend: avgDaily > 0 ? "flat" : "down" },
    demand_forecast: agg.best_sellers.map((p: any) => ({ product: p.title, predicted_units: Math.max(1, Math.round(p.units / 14)), trend: "flat" })),
    customer_lifetime_value: { average_ltv: Number((agg.aov * avgOrders).toFixed(2)), repeat_rate: Number(repeat_rate.toFixed(2)), top_customer_ltv: agg.top_customers[0]?.spend || 0 },
    repeat_purchase_insights: `${agg.repeat_customers} of ${agg.customer_count} customers have ordered more than once (repeat rate ${Math.round(repeat_rate * 100)}%).`,
    order_risk_anomalies: [],
    inventory_demand_predictions: [
      ...agg.out_of_stock.map((v: any) => ({ product: v.title, status: "out_of_stock", recommendation: "Restock or disable." })),
      ...agg.low_stock.map((v: any) => ({ product: v.title, status: "low_stock", recommendation: `Only ${v.available} left — reorder soon.` })),
    ],
    recommended_actions: [
      ...(agg.unfulfilled > 0 ? [{ action: `Fulfill ${agg.unfulfilled} pending orders`, priority: "high", expected_impact: "Improves delivery satisfaction." }] : []),
      ...(agg.out_of_stock.length ? [{ action: `Restock ${agg.out_of_stock.length} out-of-stock items`, priority: "high", expected_impact: "Recovers lost sales." }] : []),
      { action: "Email repeat customers a loyalty offer", priority: "medium", expected_impact: "Lifts repeat rate." },
    ],
    provider: "local-intelligence",
  };
}

export default async function (req: Request): Promise<Response> {
  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "storefront").toLowerCase();
    if (!VALID_ACTIONS.some((a) => a.toLowerCase() === action)) {
      return Response.json(
        { error: `Invalid action. Use one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const auth = await getShopifyAdminToken();
    if (!auth.token) {
      return Response.json(
        {
          shopify: { connected: false, domain: auth.domain, error: auth.error },
          error: auth.error || "Shopify not configured",
        },
        { status: 502 }
      );
    }

    // Shopify-origin authenticity (HMAC over embed/callback URL params).
    const params = payload.params && typeof payload.params === "object" ? payload.params : {};
    let hmacValid = false;
    const apiSecret = String(secrets.get("SHOPIFY_CLIENT_SECRET") || "").trim();
    const clientId = String(secrets.get("SHOPIFY_CLIENT_ID") || "").trim();
    if (params.hmac || params.signature) {
      if (apiSecret) hmacValid = await verifyShopifyHmac(params, apiSecret);
    }
    // Verify the Shopify session JWT. For live embedded requests, Shopify App Bridge
    // supplies a short-lived token that the frontend sends as Authorization: Bearer.
    // Keep id_token as a compatibility fallback for document/callback loads, but do
    // not treat URL HMAC alone as sufficient authorization for sensitive order data.
    const authHeader = String(req.headers.get("Authorization") || "");
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    // Base44's function gateway may forward Shopify's Authorization header in
    // platform request metadata rather than the inner Request headers. Accept
    // explicit session_token from the already-loaded embedded client as a
    // transport fallback; it is still cryptographically verified below before
    // any sensitive Shopify data is returned.
    const explicitSessionToken = String(payload.session_token || payload.sessionToken || "").trim();
    const sessionToken = bearerToken || explicitSessionToken || String(params.id_token || "");
    const session = sessionToken
      ? await verifyShopifySession(sessionToken, apiSecret, clientId)
      : { valid: false };
    // Shopify may issue a session token whose `aud` is an array in some JWT
    // implementations. verifyShopifySession handles both string and array audiences.
    // Also bind the token to the configured shop so a valid token from another shop
    // can never authorize this backend.
    const normalizeShopDomain = (value: unknown) => String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    const sessionShop = normalizeShopDomain(session.shop);
    const configuredShop = normalizeShopDomain(auth.domain);
    const requestedShop = normalizeShopDomain(params.shop || payload.shop);
    // Bind sensitive reads to the Shopify Admin session that launched this embed.
    // A merchant may have reinstalled/renamed the app while an older configured
    // shop domain remains in server credentials. A cryptographically valid Shopify
    // session is authoritative for the active shop; require the URL shop to agree
    // with it when Shopify supplies that parameter.
    const shopMatches = !requestedShop || !sessionShop || requestedShop === sessionShop;
    const authenticated = session.valid === true && shopMatches;
    const sessionRejectReason = !sessionToken
      ? "No Shopify session token reached the backend."
      : session.valid !== true
        ? (session.error || "Shopify session token verification failed.")
        : !shopMatches
          ? `Shop mismatch (${sessionShop || "unknown"} != ${requestedShop || "unknown"}).`
          : "Shopify session rejected.";

    const base = shopifyAdminBase(auth.domain);
    const token = auth.token;

    // ----- health -----
    if (action === "health") {
      return Response.json({
        shopify: {
          connected: true,
          domain: auth.domain,
          token_source: auth.source,
          scope: auth.scope || null,
        },
        client_id: clientId || null,
        hmac_valid: hmacValid,
        session,
        embedded: Boolean(params.embedded || params.host),
      });
    }

    // ----- storefront (shop + catalog, one round-trip) -----
    if (action === "storefront") {
      const cap = Math.min(250, Math.max(1, Number(payload.limit) || 250));
      const [shopR, productsR] = await Promise.all([
        shoGet(`${base}/shop.json`, token),
        shoGet(`${base}/products.json?limit=${cap}`, token),
      ]);
      const authError =
        shopR.status === 401 || productsR.status === 401
          ? "Your Shopify access token is invalid or expired. Update SHOPIFY_CLIENT_SECRET and SHOPIFY_ACCESS_TOKEN in Base44 Secrets, or reinstall LOKIN Commerce from your Shopify Admin."
          : shopR.status === 404 || productsR.status === 404
          ? "Shopify store domain not found. Verify SHOPIFY_STORE_DOMAIN in Base44 Secrets."
          : null;
      if (authError) return Response.json({ error: authError, shopify_status: shopR.status || productsR.status }, { status: 401 });
      if (!shopR.ok) return Response.json({ error: shopR.error }, { status: shopR.status });
      if (!productsR.ok) return Response.json({ error: productsR.error }, { status: productsR.status });
      return Response.json({
        ...mapStorefront(shopR.data?.shop || {}, productsR.data),
        hmac_valid: hmacValid,
        session,
      });
    }

    // ----- orders (HMAC-gated) -----
    if (action === "orders") {
      if (!authenticated) {
        return Response.json(
          { error: `Shopify session rejected for orders: ${sessionRejectReason}` },
          { status: 403 }
        );
      }
      const limit = Math.min(250, Math.max(1, Number(payload.limit) || 50));
      const status = payload.status ? `&status=${encodeURIComponent(payload.status)}` : "";
      const r = await shoGet(`${base}/orders.json?limit=${limit}${status}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ orders: mapOrdersRich(r.data) });
    }

    // ----- single order (HMAC-gated) -----
    if (action === "order") {
      if (!authenticated) {
        return Response.json({ error: "Authenticated Shopify session required for order details." }, { status: 403 });
      }
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await shoGet(`${base}/orders/${encodeURIComponent(id)}.json`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ order: r.data?.order });
    }

    // ----- draft orders list (session-gated) -----
    if (action === "drafts") {
      if (!authenticated) {
        return Response.json({ error: `Shopify session rejected for draft orders: ${sessionRejectReason}` }, { status: 403 });
      }
      const limit = Math.min(250, Math.max(1, Number(payload.limit) || 50));
      const r = await shoGet(`${base}/draft_orders.json?limit=${limit}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ drafts: mapDrafts(r.data) });
    }

    // ----- single draft (session-gated) -----
    if (action === "draft") {
      if (!authenticated) {
        return Response.json({ error: "Authenticated Shopify session required for draft details." }, { status: 403 });
      }
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await shoGet(`${base}/draft_orders/${encodeURIComponent(id)}.json`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ draft: r.data?.draft_order });
    }

    // ----- create draft order (session-gated) -----
    if (action === "createdraft") {
      if (!authenticated) {
        return Response.json({ error: "Authenticated Shopify session required to create drafts." }, { status: 403 });
      }
      const items = Array.isArray(payload.line_items) ? payload.line_items : [];
      const line_items = items
        .map((it: any) => ({
          variant_id: it.variant_id ? Number(it.variant_id) : undefined,
          title: it.variant_id ? undefined : String(it.title || "Custom item"),
          quantity: Math.max(1, Math.min(100, Number(it.quantity) || 1)),
          price: it.variant_id ? undefined : (it.price != null ? String(it.price) : undefined),
        }))
        .filter((it: any) => it.variant_id || it.title);
      if (!line_items.length) {
        return Response.json({ error: "At least one line item is required." }, { status: 400 });
      }
      const draft: any = { line_items };
      // Shopify Draft Orders accept a notification email directly on draft_order.email.
      // Do not send an email-only `customer` object: Shopify expects an existing customer
      // identity there and can silently create the draft without attaching the address.
      if (payload.email) draft.email = String(payload.email).trim();
      if (payload.note) draft.note = String(payload.note);
      const r = await shoPost(`${base}/draft_orders.json`, { draft_order: draft }, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const d = r.data?.draft_order || {};
      return Response.json({
        draft: { id: d.id, name: d.name, status: d.status, total_price: d.total_price, invoice_url: d.invoice_url, email: d.email || d.customer?.email || "" },
      });
    }

    // ----- update draft order (session-gated) -----
    if (action === "updatedraft") {
      if (!authenticated) {
        return Response.json({ error: "Authenticated Shopify session required to update drafts." }, { status: 403 });
      }
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const draft_order: any = { id: Number(id) };
      if (Array.isArray(payload.line_items)) {
        const items = safeDraftLineItems(payload.line_items);
        if (!items.length) return Response.json({ error: "Draft order must contain at least one line item." }, { status: 400 });
        draft_order.line_items = items;
      }
      if (payload.email !== undefined) draft_order.email = String(payload.email || "").trim() || null;
      if (payload.note !== undefined) draft_order.note = String(payload.note || "").slice(0, 5000);
      if (payload.applied_discount !== undefined) {
        const ad = payload.applied_discount || null;
        draft_order.applied_discount = ad && Number(ad.value) > 0 ? {
          description: String(ad.description || ad.title || "LOKIN discount").slice(0, 255),
          title: String(ad.title || "LOKIN discount").slice(0, 255),
          value_type: ad.value_type === "fixed_amount" ? "fixed_amount" : "percentage",
          value: String(Math.max(0, Number(ad.value) || 0)),
        } : null;
      }
      if (payload.shipping_line !== undefined) {
        const sl = payload.shipping_line || null;
        draft_order.shipping_line = sl && Number(sl.price) >= 0 && String(sl.title || "").trim() ? {
          title: String(sl.title).slice(0, 255),
          custom: true,
          price: String(Math.max(0, Number(sl.price) || 0)),
        } : null;
      }
      const r = await shoPut(`${base}/draft_orders/${encodeURIComponent(id)}.json`, { draft_order }, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ draft: r.data?.draft_order || null });
    }

    // ----- complete draft into an order (session-gated) -----
    if (action === "completedraft") {
      if (!authenticated) {
        return Response.json({ error: "Authenticated Shopify session required to complete drafts." }, { status: 403 });
      }
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await shoPut(`${base}/draft_orders/${encodeURIComponent(id)}/complete.json`, {}, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ ok: true, draft: r.data?.draft_order || null });
    }

    // ----- draft AI intelligence (session-gated) -----
    if (action === "draftai") {
      if (!authenticated) {
        return Response.json({ error: "Authenticated Shopify session required for draft intelligence." }, { status: 403 });
      }
      const id = String(payload.id || "");
      const mode = ["summary", "discount", "followup"].includes(String(payload.mode || "")) ? String(payload.mode) : "summary";
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const dr = await shoGet(`${base}/draft_orders/${encodeURIComponent(id)}.json`, token);
      if (!dr.ok) return Response.json({ error: dr.error }, { status: dr.status });
      const draft = draftForAI(dr.data?.draft_order || {});
      const openaiKey = String(secrets.get("OPENAI_API_KEY") || "").trim();
      const model = String(secrets.get("OPENAI_LOW_COST_MODEL") || secrets.get("OPENAI_MODEL") || "gpt-5.6-luna").trim();

      const fallback = () => {
        const total = Number(draft.total_price || 0);
        const items = (draft.line_items || []).reduce((n: number, it: any) => n + Number(it.quantity || 0), 0);
        if (mode === "discount") {
          const pct = total >= 150 ? 10 : total >= 75 ? 7 : 5;
          return { recommendation: `${pct}%`, reason: `A modest ${pct}% incentive balances conversion with margin protection for a ${draft.currency || "USD"} ${total.toFixed(2)} draft.`, percent: pct };
        }
        if (mode === "followup") {
          const first = draft.customer?.first_name ? ` ${draft.customer.first_name}` : "";
          return { message: `Hi${first}! Your ${draft.name || "LOKIN order"} is ready. I can send the secure invoice whenever you're ready to complete checkout. Let me know if you have any questions.` };
        }
        return { summary: `${draft.name || "Draft order"} is ${draft.status || "open"} with ${items} item${items === 1 ? "" : "s"} totaling ${draft.currency || "USD"} ${total.toFixed(2)}${draft.email ? ` for ${draft.email}` : " with no customer email attached"}.` };
      };

      if (!openaiKey) return Response.json({ ...fallback(), provider: "local-intelligence" });
      const instruction = mode === "discount"
        ? "Recommend one sensible discount percentage from 0 to 20 for this draft. Protect margin. Return strict JSON: {\"recommendation\":\"10%\",\"reason\":\"...\",\"percent\":10}."
        : mode === "followup"
          ? "Draft a concise friendly customer follow-up that encourages completion without pressure. Return strict JSON: {\"message\":\"...\"}."
          : "Summarize this draft order for a merchant in 2 concise sentences and mention any obvious missing customer/contact detail. Return strict JSON: {\"summary\":\"...\"}.";
      try {
        const ai = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, input: `${instruction}\nDraft: ${JSON.stringify(draft)}` }),
        });
        const data: any = await ai.json().catch(() => ({}));
        if (!ai.ok) return Response.json({ ...fallback(), provider: "local-intelligence", ai_error: `OpenAI request failed (${ai.status})` });
        let text = String(data?.output_text || "").trim();
        if (!text) {
          for (const item of data?.output || []) for (const c of item?.content || []) if (typeof c?.text === "string") text += c.text;
        }
        const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
        return Response.json({ ...parsed, provider: "openai" });
      } catch {
        return Response.json({ ...fallback(), provider: "local-intelligence" });
      }
    }

    // ----- send draft invoice (session-gated) -----
    if (action === "sendinvoice") {
      if (!authenticated) {
        return Response.json({ error: "Authenticated Shopify session required to send invoices." }, { status: 403 });
      }
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });

      // Re-read the draft before sending so invoice delivery never relies on stale UI state.
      const dr = await shoGet(`${base}/draft_orders/${encodeURIComponent(id)}.json`, token);
      if (!dr.ok) return Response.json({ error: dr.error }, { status: dr.status });
      const draft = dr.data?.draft_order || {};
      const email = String(draft.email || draft.customer?.email || "").trim();
      if (!email) {
        return Response.json({ error: "Add and save a customer email before sending this invoice." }, { status: 400 });
      }

      const r = await shoPost(`${base}/draft_orders/${encodeURIComponent(id)}/send_invoice.json`, {}, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ ok: true, sent: true, email, invoice_url: r.data?.draft_order_invoice?.url || null });
    }

    // ----- commerce intelligence (session-gated) -----
    if (action === "intelligence") {
      if (!authenticated) {
        return Response.json({ error: `Shopify session rejected for intelligence: ${sessionRejectReason}` }, { status: 403 });
      }
      const limit = Math.min(250, Math.max(1, Number(payload.limit) || 250));
      const [ordersR, productsR] = await Promise.all([
        shoGet(`${base}/orders.json?limit=${limit}&status=any`, token),
        shoGet(`${base}/products.json?limit=250`, token),
      ]);
      if (!ordersR.ok) return Response.json({ error: ordersR.error }, { status: ordersR.status });
      if (!productsR.ok) return Response.json({ error: productsR.error }, { status: productsR.status });
      const orders = mapOrdersRich(ordersR.data);
      const products = (productsR.data?.products || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        thumbnail_url: p.image?.src,
        status: p.status,
        variants: (p.variants || []).map((v: any) => ({ id: v.id, sku: v.sku, price: v.price, available: v.inventory_quantity ?? null })),
      }));
      const agg = buildOrderAggregate(orders, products);
      const openaiKey = String(secrets.get("OPENAI_API_KEY") || "").trim();
      const model = String(secrets.get("OPENAI_LOW_COST_MODEL") || secrets.get("OPENAI_MODEL") || "gpt-5.6-luna").trim();
      if (!openaiKey) {
        return Response.json({ confirmed: agg, predictions: localIntelligence(agg) });
      }
      try {
        const compact = {
          order_count: agg.order_count, total_revenue: agg.total_revenue, aov: agg.aov,
          paid: agg.paid, unfulfilled: agg.unfulfilled, fulfilled: agg.fulfilled, partial: agg.partial, refunded: agg.refunded,
          customer_count: agg.customer_count, repeat_customers: agg.repeat_customers,
          daily_revenue: agg.daily_revenue.map((d: any) => d.revenue),
          top_products: agg.top_products.map((p: any) => ({ title: p.title, units: p.units, revenue: p.revenue })),
          top_customers: agg.top_customers.map((c: any) => ({ name: c.name, orders: c.orders, spend: c.spend })),
          low_stock: agg.low_stock, out_of_stock: agg.out_of_stock,
        };
        const instruction = "You are LOKIN Commerce Intelligence. Analyze this Shopify store aggregate (confirmed data) and return STRICT JSON only with these exact keys: commerce_intelligence_score {score(0-100), grade(A-F), breakdown{revenue_health,fulfillment_health,customer_health,inventory_health,risk all 0-100}}; insights array of {type,title,detail,severity(low|medium|high)}; revenue_forecast {next_7_days,next_30_days,confidence(low|medium|high),trend(up|down|flat)}; demand_forecast array of {product,predicted_units,trend}; customer_lifetime_value {average_ltv,repeat_rate(0-1),top_customer_ltv}; repeat_purchase_insights string; order_risk_anomalies array of {order,risk_type,detail}; inventory_demand_predictions array of {product,status,recommendation}; recommended_actions array of {action,priority(low|medium|high),expected_impact}. Return ONLY JSON, no prose.";
        const ai = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, input: `${instruction}\nAggregate: ${JSON.stringify(compact)}` }),
        });
        const data: any = await ai.json().catch(() => ({}));
        if (!ai.ok) return Response.json({ confirmed: agg, predictions: { ...localIntelligence(agg), ai_error: `OpenAI request failed (${ai.status})` } });
        let text = String(data?.output_text || "").trim();
        if (!text) {
          for (const item of data?.output || []) for (const c of item?.content || []) if (typeof c?.text === "string") text += c.text;
        }
        const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
        return Response.json({ confirmed: agg, predictions: { ...parsed, provider: "openai" } });
      } catch (e: any) {
        return Response.json({ confirmed: agg, predictions: { ...localIntelligence(agg), ai_error: String(e?.message || e) } });
      }
    }

    // ----- mark order fulfilled (session-gated Shopify write) -----
    if (action === "fulfillorder") {
      if (!authenticated) {
        return Response.json({ error: `Shopify session rejected for fulfillment: ${sessionRejectReason}` }, { status: 403 });
      }
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });

      // 1. Resolve the order's fulfillment orders (modern Shopify fulfillment API).
      const foRes = await shoGet(`${base}/orders/${encodeURIComponent(id)}/fulfillment_orders.json`, token);
      if (!foRes.ok) return Response.json({ error: foRes.error || "Unable to load fulfillment orders." }, { status: foRes.status });
      const fulfillmentOrders = Array.isArray(foRes.data?.fulfillment_orders) ? foRes.data.fulfillment_orders : [];
      if (!fulfillmentOrders.length) {
        return Response.json({ error: "This order has no fulfillment orders (it may already be fulfilled or was imported as fulfilled)." }, { status: 400 });
      }
      const fulfillable = fulfillmentOrders.find(
        (fo: any) => fo.status === "open" && Array.isArray(fo.supported_actions) && fo.supported_actions.includes("create_fulfillment")
      );
      if (!fulfillable) {
        return Response.json({ error: "No fulfillable line items remain for this order." }, { status: 400 });
      }

      // 2. Resolve the assigned location; fall back to the first active location.
      let locationId: number | null = fulfillable.assigned_location_id || null;
      if (!locationId) {
        const locRes = await shoGet(`${base}/locations.json`, token);
        if (locRes.ok) {
          const locs = Array.isArray(locRes.data?.locations) ? locRes.data.locations : [];
          const active = locs.find((l: any) => l.active);
          locationId = active?.id || locs[0]?.id || null;
        }
      }

      // 3. Build fulfillable line items from the fulfillment order.
      const lineItems = (fulfillable.fulfillment_order_line_items || [])
        .filter((li: any) => (li.fulfillable_quantity ?? li.quantity ?? 0) > 0)
        .map((li: any) => ({ id: li.id, quantity: li.fulfillable_quantity > 0 ? li.fulfillable_quantity : li.quantity }));
      if (!lineItems.length) {
        return Response.json({ error: "No fulfillable line items remain for this order." }, { status: 400 });
      }

      const body: any = {
        fulfillment: {
          line_items_by_fulfillment_order: [
            { fulfillment_order_id: fulfillable.id, fulfillment_order_line_items: lineItems },
          ],
        },
      };
      if (locationId) body.fulfillment.location_id = locationId;

      // 4. Create the fulfillment. This is the authoritative Shopify write — no local simulation.
      const fRes = await shoPost(`${base}/fulfillments.json`, body, token);
      if (!fRes.ok) {
        return Response.json({ error: fRes.error || "Shopify rejected the fulfillment write." }, { status: fRes.status });
      }

      // 5. Re-read the confirmed order so the UI reflects Shopify's authoritative state.
      const orderRes = await shoGet(`${base}/orders/${encodeURIComponent(id)}.json`, token);
      if (!orderRes.ok) {
        return Response.json({ error: "Fulfillment created, but the order could not be re-read. Refresh to sync." }, { status: orderRes.status });
      }
      const mapped = mapOrdersRich({ orders: [orderRes.data?.order] })[0] || null;
      return Response.json({ ok: true, fulfillment: fRes.data?.fulfillment || null, order: mapped });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("shopify-embed error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}