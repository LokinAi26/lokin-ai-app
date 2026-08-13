import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { jsonRequest } from "../../shared/printRequest.ts";

// Printify store catalog & product integration for the LOKIN Brand Store.
// The PRINTIFY_API_TOKEN is read server-side only and never returned to the client.
// Printify API docs: https://developers.printify.com (Personal API token)
// Auth: Authorization: Bearer <token>; shop id is part of the URL path.

const API = "https://api.printify.com/v1";
const VALID_ACTIONS = ["shops", "products", "product", "catalog", "orders", "order", "createProduct"];

async function pfyGet(path, token) {
  const r = await jsonRequest({ url: `${API}${path}`, headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, data: r.data };
}

async function pfyPost(path, token, body) {
  const r = await jsonRequest({ url: `${API}${path}`, method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, data: r.data };
}

function shopIdRequired(payload) {
  const shopId = String(payload.shop_id || payload.shopId || "");
  if (!shopId) return null;
  return shopId;
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

    // Orders, single order, and product creation are admin-only (fulfillment/billing ops)
    if ((action === "orders" || action === "order" || action === "createProduct") && user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const token = secrets.get("PRINTIFY_API_TOKEN");
    if (!token) {
      return Response.json({ error: "PRINTIFY_API_TOKEN is not configured." }, { status: 500 });
    }

    // ----- Shops list (auto-resolve shop id; id itself is not sensitive) -----
    if (action === "shops") {
      const r = await pfyGet(`/shops.json`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const shops = (r.data || []).map((s) => ({
        id: s.id,
        title: s.title,
        sales_channel: s.sales_channel,
        currency: s.currency,
        state: s.state,
      }));
      return Response.json({ shops });
    }

    const shopId = shopIdRequired(payload);
    if (!shopId) return Response.json({ error: "shop_id is required for this action." }, { status: 400 });

    // ----- Products list -----
    if (action === "products") {
      const page = Math.max(1, Number(payload.page) || 1);
      const r = await pfyGet(`/shops/${encodeURIComponent(shopId)}/products.json?page=${page}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const products = (r.data || []).map((p) => ({
        id: p.id,
        title: p.title,
        visible: p.visible,
        is_locked: p.is_locked,
        image: p.images?.[0]?.src,
        variants_count: (p.variants || []).length,
      }));
      return Response.json({ products, page });
    }

    // ----- Single product (variants, prices, images) -----
    if (action === "product") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await pfyGet(`/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(id)}.json`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const p = r.data || {};
      const variants = (p.variants || []).map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        cost: v.cost,
        price: v.price,
        is_enabled: v.is_enabled,
        options: v.options,
      }));
      return Response.json({
        product: {
          id: p.id,
          title: p.title,
          description: p.description,
          blueprint_id: p.blueprint_id,
          print_provider_id: p.print_provider_id,
          visible: p.visible,
          images: p.images,
          variants,
        },
      });
    }

    // ----- Enriched catalog (all products + variants with price & image) -----
    if (action === "catalog") {
      const cap = Math.min(200, Math.max(1, Number(payload.limit) || 200));
      const collected = [];
      let page = 1;
      while (collected.length < cap) {
        const r = await pfyGet(`/shops/${encodeURIComponent(shopId)}/products.json?page=${page}`, token);
        if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
        const batch = Array.isArray(r.data) ? r.data : [];
        collected.push(...batch);
        if (batch.length === 0) break;
        page += 1;
        if (page > 50) break; // safety guard
      }
      const detailed = await Promise.all(
        collected.slice(0, cap).map(async (p) => {
          const r = await pfyGet(`/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(p.id)}.json`, token);
          if (!r.ok) return null;
          const d = r.data || {};
          const variants = (d.variants || []).map((v) => ({
            id: v.id,
            title: v.title,
            price: v.price,
            is_enabled: v.is_enabled,
          }));
          const prices = variants.map((v) => Number(v.price)).filter((n) => !isNaN(n));
          return {
            id: d.id,
            title: d.title,
            thumbnail_url: d.images?.[0]?.src,
            visible: d.visible,
            variants,
            min_price: prices.length ? Math.min(...prices).toFixed(2) : null,
            max_price: prices.length ? Math.max(...prices).toFixed(2) : null,
            currency: "USD",
          };
        })
      );
      const products = detailed.filter(Boolean);
      return Response.json({ products, shopId, count: products.length });
    }

    // ----- Orders list (admin-only) -----
    if (action === "orders") {
      const page = Math.max(1, Number(payload.page) || 1);
      const r = await pfyGet(`/shops/${encodeURIComponent(shopId)}/orders.json?page=${page}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const orders = (r.data || []).map((o) => ({
        id: o.id,
        status: o.status,
        total: o.total_price,
        currency: o.currency,
        customer: o.customer,
        created: o.created_at,
        items_count: (o.line_items || []).length,
      }));
      return Response.json({ orders, page });
    }

    // ----- Single order (admin-only) -----
    if (action === "order") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await pfyGet(`/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(id)}.json`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ order: r.data });
    }

    // ----- Create a product in the LOKIN Printify shop (admin-only) -----
    // Printify requires: title, blueprint_id, print_provider_id, variants[], print_areas.
    // Accept a validated product body and forward it; the caller composes the print areas/artwork.
    if (action === "createProduct") {
      const p = payload.product;
      if (!p || typeof p !== "object") {
        return Response.json({ error: "product object is required." }, { status: 400 });
      }
      if (!p.title || !p.blueprint_id || !p.print_provider_id || !Array.isArray(p.variants) || !p.variants.length) {
        return Response.json({ error: "product requires title, blueprint_id, print_provider_id, and a non-empty variants array." }, { status: 400 });
      }
      const r = await pfyPost(`/shops/${encodeURIComponent(shopId)}/products.json`, token, p);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ product: { id: r.data?.id, title: r.data?.title } });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("printify-catalog error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}