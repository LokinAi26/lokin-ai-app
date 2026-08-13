import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { jsonRequest } from "../../shared/printRequest.ts";
import { shopifyDemo } from "../../shared/demoCatalog.ts";

/**
 * shopify-catalog — LOKIN Brand Store <-> Shopify Admin REST API integration.
 *
 * Secures the Shopify Admin API behind a backend function so the access token
 * never reaches the client. Client call:
 *   base44.functions.invoke('shopify-catalog', { action, ... })
 *
 * Secrets: SHOPIFY_STORE_DOMAIN (e.g. store.myshopify.com) + SHOPIFY_ACCESS_TOKEN — server-side only.
 * Header: X-Shopify-Access-Token. Admin API version pinned to 2024-07.
 *
 * Auth model — storefront reads are open to any logged-in user; fulfillment +
 * billing actions are admin-only:
 *   shop / products / product / catalog  -> any user
 *   orders / order / createProduct       -> admin only
 *
 * Actions (payload.action):
 *   shop          shop info
 *   products      paginated products list (page_info cursor via Link header)
 *   product       single product + variants
 *   catalog       enriched storefront catalog (all products + variants, min/max price)
 *   orders/order  order list/detail (admin)
 *   createProduct create a product (admin)
 *
 * Docs: https://shopify.dev/docs/api/admin-rest
 */

const API_VERSION = "2024-07";
const VALID_ACTIONS = ["shop", "products", "product", "catalog", "orders", "order", "createProduct"];

function baseUrl(domain) {
  return `https://${domain}/admin/api/${API_VERSION}`;
}

async function shoGet(path) {
  const r = await jsonRequest({ url: path, headers: { "X-Shopify-Access-Token": secrets.get("SHOPIFY_ACCESS_TOKEN") } });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, data: r.data };
}

async function shoPost(path, body) {
  const r = await jsonRequest({
    url: path,
    method: "POST",
    headers: { "X-Shopify-Access-Token": secrets.get("SHOPIFY_ACCESS_TOKEN") },
    body,
  });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, data: r.data };
}

function variantSummary(v) {
  return {
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price,
    compare_at_price: v.compare_at_price,
    available: v.inventory_quantity ?? null,
    option1: v.option1,
    option2: v.option2,
  };
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

    if ((action === "orders" || action === "order" || action === "createProduct") && user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const domain = secrets.get("SHOPIFY_STORE_DOMAIN");
    const token = secrets.get("SHOPIFY_ACCESS_TOKEN");
    // Demo/sandbox fallback: when either secret is missing, serve clearly-flagged
    // sample data so the storefront renders instead of erroring. Add the real
    // SHOPIFY_STORE_DOMAIN + SHOPIFY_ACCESS_TOKEN in Settings -> Secrets to go live.
    if (!domain || !token) {
      return Response.json(shopifyDemo(action, payload));
    }

    const base = baseUrl(domain);

    // ----- Shop info -----
    if (action === "shop") {
      const r = await shoGet(`${base}/shop.json`);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const s = r.data?.shop || {};
      return Response.json({
        shop: {
          id: s.id,
          name: s.name,
          domain: s.domain,
          currency: s.currency,
          country: s.country,
          plan: s.plan_name,
        },
      });
    }

    // ----- Products list -----
    if (action === "products") {
      const limit = Math.min(250, Math.max(1, Number(payload.limit) || 50));
      const pageInfo = payload.page_info ? `&page_info=${encodeURIComponent(payload.page_info)}` : "";
      const r = await shoGet(`${base}/products.json?limit=${limit}${pageInfo}`);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const products = (r.data?.products || []).map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        vendor: p.vendor,
        product_type: p.product_type,
        image: p.image?.src,
        variants_count: (p.variants || []).length,
      }));
      const link = r.headers?.get?.("link") || null;
      return Response.json({ products, link });
    }

    // ----- Single product -----
    if (action === "product") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await shoGet(`${base}/products/${encodeURIComponent(id)}.json`);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const p = r.data?.product || {};
      return Response.json({
        product: {
          id: p.id,
          title: p.title,
          body_html: p.body_html,
          vendor: p.vendor,
          product_type: p.product_type,
          status: p.status,
          images: p.images,
          variants: (p.variants || []).map(variantSummary),
        },
      });
    }

    // ----- Enriched catalog (all products + variants with price & image) -----
    if (action === "catalog") {
      const cap = Math.min(250, Math.max(1, Number(payload.limit) || 250));
      const r = await shoGet(`${base}/products.json?limit=${cap}`);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const products = (r.data?.products || []).map((p) => {
        const variants = (p.variants || []).map(variantSummary);
        const prices = variants.map((v) => Number(v.price)).filter((n) => !isNaN(n));
        return {
          id: p.id,
          title: p.title,
          thumbnail_url: p.image?.src,
          status: p.status,
          variants,
          min_price: prices.length ? Math.min(...prices).toFixed(2) : null,
          max_price: prices.length ? Math.max(...prices).toFixed(2) : null,
          currency: "USD",
        };
      });
      return Response.json({ products, count: products.length });
    }

    // ----- Orders list (admin-only) -----
    if (action === "orders") {
      const limit = Math.min(250, Math.max(1, Number(payload.limit) || 50));
      const status = payload.status ? `&status=${encodeURIComponent(payload.status)}` : "";
      const r = await shoGet(`${base}/orders.json?limit=${limit}${status}`);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const orders = (r.data?.orders || []).map((o) => ({
        id: o.id,
        name: o.name,
        financial_status: o.financial_status,
        fulfillment_status: o.fulfillment_status,
        total_price: o.total_price,
        currency: o.currency,
        customer: o.customer ? { email: o.customer.email, name: `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() } : null,
        created_at: o.created_at,
        items_count: (o.line_items || []).length,
      }));
      return Response.json({ orders });
    }

    // ----- Single order (admin-only) -----
    if (action === "order") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await shoGet(`${base}/orders/${encodeURIComponent(id)}.json`);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ order: r.data?.order });
    }

    // ----- Create a product (admin-only) -----
    if (action === "createProduct") {
      const p = payload.product;
      if (!p || typeof p !== "object" || !p.title) {
        return Response.json({ error: "product object with a title is required." }, { status: 400 });
      }
      const body = {
        product: {
          title: p.title,
          body_html: p.body_html || "",
          vendor: p.vendor || "LOKIN AI",
          product_type: p.product_type || "Apparel",
          status: p.status || "draft",
          variants: Array.isArray(p.variants) ? p.variants : undefined,
        },
      };
      const r = await shoPost(`${base}/products.json`, body);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ product: { id: r.data?.product?.id, title: r.data?.product?.title } });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("shopify-catalog error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}