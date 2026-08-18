import { secrets } from "base44:runtime";
import { getShopifyAdminToken } from "../../shared/shopifyAuth.ts";
import { verifyShopifyHmac } from "../../shared/shopifyHmac.ts";
import { verifyShopifySession } from "../../shared/shopifyJwt.ts";
import { shopifyAdminBase, shoGet, mapStorefront, mapOrders, mapDrafts } from "../../shared/shopifyReads.ts";

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
const VALID_ACTIONS = ["health", "storefront", "orders", "order", "drafts", "draft", "createDraft", "updateDraft", "sendInvoice", "completeDraft", "draftAI"];

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
      return Response.json({ orders: mapOrders(r.data) });
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
        draft: { id: d.id, name: d.name, status: d.status, total_price: d.total_price, invoice_url: d.invoice_url },
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
      const r = await shoPost(`${base}/draft_orders/${encodeURIComponent(id)}/send_invoice.json`, {}, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ ok: true, sent: true, invoice_url: r.data?.draft_order_invoice?.url || null });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("shopify-embed error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}