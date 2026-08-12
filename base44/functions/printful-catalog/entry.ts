import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

// Printful store catalog & order integration for the LOKIN Brand Store.
// The PRINTFUL_API_TOKEN is read server-side only and never returned to the client.
// Docs: https://developers.printful.com (Store API)

const API = "https://api.printful.com";
const VALID_ACTIONS = ["store", "products", "product", "availability", "orders", "order"];

async function pfGet(path, token, storeId) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (storeId) headers["X-PF-Store"] = String(storeId);
  const res = await fetch(`${API}${path}`, { headers });
  let body;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error || `Printful request failed (${res.status})`;
    return { ok: false, status: res.status, error: msg };
  }
  return { ok: true, code: body?.code, result: body?.result, paging: body?.paging, extras: body?.extras };
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
    if ((action === "orders" || action === "order" || action === "store") && user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const token = secrets.get("PRINTFUL_API_TOKEN");
    if (!token) {
      return Response.json({ error: "PRINTFUL_API_TOKEN is not configured." }, { status: 500 });
    }
    // Printful requires the store ID for the Store API when a personal token has
    // multiple stores. Accept a payload override or a stored secret; not sensitive.
    const storeId = payload.storeId || secrets.get("PRINTFUL_STORE_ID") || "";

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