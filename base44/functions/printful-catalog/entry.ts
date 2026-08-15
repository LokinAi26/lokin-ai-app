import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { jsonRequest } from "../../shared/printRequest.ts";
import { getEffectiveToken, getPrintfulConnection, oauthConfigured } from "../../shared/printfulOAuth.ts";

/**
 * printful-catalog — LOKIN Brand Store <-> Printful integration.
 *
 * Secures the Printful Store API behind a backend function so the API token
 * never reaches the client. Client call:
 *   base44.functions.invoke('printful-catalog', { action, ... })
 *
 * Secret: PRINTFUL_API_TOKEN (personal API token) — server-side only.
 * Headers: Authorization: Bearer <token>; X-PF-Store-Id when a token owns >1 store.
 *
 * Auth model — storefront reads are open to any logged-in user; fulfillment +
 * billing actions are admin-only:
 *   stores / products / product / availability / catalog / warehouse  -> any user
 *   orders / order / store / createProduct                            -> admin only
 *
 * Actions (payload.action):
 *   stores        list stores on the token (auto-resolves store id)
 *   products      paginated sync products list
 *   product       single sync product + variants (price/image/sku)
 *   availability  variant stock by variant ids
 *   catalog       enriched storefront catalog (all products + variants, min/max price) — used by PrintfulStore
 *   warehouse     Printful blank-product warehouse catalog (feeds createProduct)
 *   orders/order  order list/detail with shipments + tracking (admin)
 *   createProduct create a sync product from a warehouse blank + retail price (admin)
 *   store         current store info (admin)
 *
 * Docs: https://developers.printful.com (Store API)
 */

const API = "https://api.printful.com";
const VALID_ACTIONS = ["store", "stores", "products", "product", "availability", "orders", "order", "catalog", "warehouse", "createProduct", "connection", "disconnect"];

async function pfGet(path, token, storeId) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (storeId) headers["X-PF-Store-Id"] = String(storeId);
  const r = await jsonRequest({ url: `${API}${path}`, headers });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  const d = r.data || {};
  return { ok: true, code: d.code, result: d.result, paging: d.paging, extras: d.extras };
}

async function pfPost(path, token, storeId, body) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (storeId) headers["X-PF-Store-Id"] = String(storeId);
  const r = await jsonRequest({ url: `${API}${path}`, method: "POST", headers, body });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, code: r.data?.code, result: r.data?.result };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "").toLowerCase();
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json({ error: `Invalid action. Use one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
    }

    // Orders and store info are admin-only (sensitive fulfillment/billing data)
    if ((action === "orders" || action === "order" || action === "store" || action === "createProduct") && user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    // ----- Connection status (works without a token) -----
    if (action === "connection") {
      const conn = await getPrintfulConnection(base44, user.id);
      const hasPersonal = !!secrets.get("PRINTFUL_API_TOKEN");
      return Response.json({
        connected: !!(conn && conn.status !== "disconnected" && conn.access_token),
        source: conn && conn.access_token ? "oauth" : (hasPersonal ? "personal" : "none"),
        oauth_configured: oauthConfigured(secrets),
        store: conn ? { id: conn.store_id, name: conn.store_name, type: conn.store_type } : null,
        connected_at: conn?.connected_at || null,
        expires_at: conn?.expires_at || 0,
        has_personal_token: hasPersonal,
      });
    }

    // ----- Disconnect OAuth (works without a token) -----
    if (action === "disconnect") {
      const conn = await getPrintfulConnection(base44, user.id);
      if (conn) await base44.asServiceRole.entities.PrintfulConnection.delete(conn.id);
      return Response.json({ disconnected: true });
    }

    const { token, storeId: tokenStoreId } = await getEffectiveToken(base44, user, secrets);
    if (!token) {
      return Response.json({ error: "No Printful OAuth connection or PRINTFUL_API_TOKEN is configured." }, { status: 500 });
    }
    // storeId: prefer explicit payload override, else the OAuth connection's store.
    const storeId = payload.storeId || tokenStoreId || "";

    // ----- Stores list (auto-resolve store ID; the id itself is not sensitive) -----
    if (action === "stores") {
      const r = await pfGet(`/stores`, token, "");
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const stores = (r.result || []).map((s) => ({ id: s.id, name: s.name, type: s.type }));
      return Response.json({ stores });
    }

    // ----- Products list -----
    if (action === "products") {
      const offset = Math.max(0, Number(payload.offset) || 0);
      const limit = Math.min(100, Math.max(1, Number(payload.limit) || 50));
      const r = await pfGet(`/store/products?offset=${offset}&limit=${limit}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const products = (r.result || []).map((p) => ({
        id: p.id,
        external_id: p.external_id,
        name: p.name,
        thumbnail_url: p.thumbnail_url,
        variants: p.variants,
        synced: p.synced,
        is_discontinued: p.is_discontinued,
      }));
      return Response.json({ products, paging: r.paging });
    }

    // ----- Single product with variants (prices, images) -----
    if (action === "product") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await pfGet(`/store/products/${encodeURIComponent(id)}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const sp = r.result?.sync_product || {};
      const variants = (r.result?.sync_variants || []).map((v) => ({
        id: v.id,
        external_id: v.external_id,
        variant_id: v.variant_id,
        name: v.name,
        sku: v.sku,
        retail_price: v.retail_price,
        currency: v.currency,
        thumbnail_url: v.thumbnail_url,
        image_url: v.image,
        main_category: v.main_category,
        is_discontinued: v.is_discontinued,
        product: v.product ? { id: v.product.product_id, variant_id: v.product.variant_id, image: v.product.image } : null,
        images: (v.files || []).filter((f) => f.type === "image").map((f) => ({
          id: f.id,
          type: f.type,
          url: f.url,
          preview_url: f.preview_url,
          filename: f.filename,
        })),
      }));
      return Response.json({
        product: {
          id: sp.id,
          external_id: sp.external_id,
          name: sp.name,
          thumbnail_url: sp.thumbnail_url,
          variants_count: sp.variants,
          synced: sp.synced,
        },
        variants,
      });
    }

    // ----- Variant availability / stock -----
    if (action === "availability") {
      const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : [];
      if (!ids.length) return Response.json({ error: "ids array is required" }, { status: 400 });
      const joined = ids.slice(0, 100).map(encodeURIComponent).join(",");
      const r = await pfGet(`/store/variant-availability?ids=${joined}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ availability: r.result || {} });
    }

    // ----- Orders list (with fulfillment status) -----
    if (action === "orders") {
      const offset = Math.max(0, Number(payload.offset) || 0);
      const limit = Math.min(100, Math.max(1, Number(payload.limit) || 50));
      const status = payload.status ? `&status=${encodeURIComponent(payload.status)}` : "";
      const r = await pfGet(`/store/orders?offset=${offset}&limit=${limit}${status}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const orders = (r.result || []).map((o) => ({
        id: o.id,
        external_id: o.external_id,
        status: o.status,
        fulfillment_status: o.fulfillment_status,
        shipping: o.shipping,
        customer: o.customer,
        created: o.created,
        updated: o.updated,
        currency: o.currency,
        total: o.total,
        subtotal: o.subtotal,
        shipping_cost: o.shipping_service ? { name: o.shipping_service.name, cost: o.costs?.shipping } : null,
        items_count: (o.items || []).length,
        tracking: (o.shipments || []).map((s) => ({
          carrier: s.carrier,
          service: s.service,
          tracking_number: s.tracking_number,
          tracking_url: s.tracking_url,
          shipped: s.shipped_date,
        })),
      }));
      return Response.json({ orders, paging: r.paging });
    }

    // ----- Single order detail -----
    if (action === "order") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await pfGet(`/store/orders/${encodeURIComponent(id)}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const o = r.result || {};
      return Response.json({
        order: {
          id: o.id,
          external_id: o.external_id,
          status: o.status,
          fulfillment_status: o.fulfillment_status,
          shipping: o.shipping,
          customer: o.customer,
          created: o.created,
          updated: o.updated,
          currency: o.currency,
          total: o.total,
          costs: o.costs,
          items: (o.items || []).map((it) => ({
            id: it.id,
            external_id: it.external_id,
            variant_id: it.variant_id,
            sync_variant_id: it.sync_variant_id,
            name: it.name,
            product: it.product,
            quantity: it.quantity,
            retail_price: it.retail_price,
            sku: it.sku,
            files: it.files,
          })),
          shipments: (o.shipments || []).map((s) => ({
            carrier: s.carrier,
            service: s.service,
            tracking_number: s.tracking_number,
            tracking_url: s.tracking_url,
            shipped: s.shipped_date,
          })),
        },
      });
    }

    // ----- Enriched catalog (ALL products + variants with price & image) -----
    if (action === "catalog") {
      const cap = Math.min(200, Math.max(1, Number(payload.limit) || 200));
      const base = [];
      let offset = 0;
      // Paginate through every product in the store (100 per page).
      while (base.length < cap) {
        const r = await pfGet(`/store/products?offset=${offset}&limit=100`, token, storeId);
        if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
        const batch = Array.isArray(r.result) ? r.result : [];
        base.push(...batch);
        if (batch.length < 100) break;
        offset += 100;
        if (offset > 2000) break; // safety guard
      }
      // Fetch each product's variants (price + image) in parallel.
      const detailed = await Promise.all(
        base.slice(0, cap).map(async (p) => {
          const r = await pfGet(`/store/products/${encodeURIComponent(p.id)}`, token, storeId);
          if (!r.ok) return null;
          const sp = r.result?.sync_product || {};
          const variants = (r.result?.sync_variants || []).map((v) => ({
            id: v.id,
            variant_id: v.variant_id,
            name: v.name,
            sku: v.sku,
            retail_price: v.retail_price,
            currency: v.currency,
            thumbnail_url: v.thumbnail_url,
            image_url: v.image,
            in_stock: v.availability_status !== "discontinued" && !v.is_discontinued,
          }));
          const prices = variants
            .map((v) => parseFloat(v.retail_price))
            .filter((n) => !isNaN(n));
          const currency = variants[0]?.currency || "USD";
          return {
            id: sp.id,
            external_id: sp.external_id,
            name: sp.name,
            thumbnail_url: sp.thumbnail_url,
            type: sp.type,
            variants,
            min_price: prices.length ? Math.min(...prices).toFixed(2) : null,
            max_price: prices.length ? Math.max(...prices).toFixed(2) : null,
            currency,
          };
        })
      );
      const products = detailed.filter(Boolean);
      return Response.json({ products, storeId, count: products.length });
    }

    // ----- Printful warehouse catalog (blank products + variant ids) -----
    if (action === "warehouse") {
      const offset = Math.max(0, Number(payload.offset) || 0);
      const limit = Math.min(100, Math.max(1, Number(payload.limit) || 50));
      const r = await pfGet(`/products?offset=${offset}&limit=${limit}`, token, "");
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const products = (r.result || []).map((p) => ({
        id: p.id,
        type: p.type,
        brand: p.brand,
        model: p.model,
        name: `${p.brand} ${p.model}`,
        image: p.image,
        variants: p.variants,
      }));
      return Response.json({ products, paging: r.paging });
    }

    // ----- Create a sync product in the LOKIN Printful store -----
    // Requires a Printful warehouse blank variant_id + retail price; a design
    // file URL is optional (omit to create a blank product, then add art in Printful).
    if (action === "createProduct") {
      const name = String(payload.name || "").trim();
      const variantId = Number(payload.variant_id);
      const retailPrice = String(payload.retail_price || "").trim();
      const fileUrl = String(payload.file_url || "").trim();
      if (!name || !variantId || !retailPrice) {
        return Response.json({ error: "name, variant_id, and retail_price are required." }, { status: 400 });
      }
      const syncVariant = { variant_id: variantId, retail_price: retailPrice };
      if (fileUrl) {
        syncVariant.files = [{ url: fileUrl, type: "default", placement: payload.placement || "front" }];
      }
      const r = await pfPost(`/store/products`, token, storeId, {
        sync_product: { name },
        sync_variants: [syncVariant],
      });
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({
        product: { id: r.result?.id, name: r.result?.name, external_id: r.result?.external_id },
      });
    }

    // ----- Store info -----
    if (action === "store") {
      const r = await pfGet(`/store`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ store: r.result });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("printful-catalog error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}