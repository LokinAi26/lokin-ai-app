import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { shopifyDemo } from "../../shared/demoCatalog.ts";
import { getShopifyAdminToken } from "../../shared/shopifyAuth.ts";
import {
  shopifyAdminBase,
  shoGet,
  variantSummary,
  mapShopSummary,
  mapStorefront,
  mapOrders,
} from "../../shared/shopifyReads.ts";

/**
 * shopify-catalog — LOKIN Brand Store <-> Shopify Admin REST API integration.
 *
 * Secures the Shopify Admin API behind a backend function so the access token
 * never reaches the client. Client call:
 *   base44.functions.invoke('shopify-catalog', { action, ... })
 *
 * Secrets: SHOPIFY_STORE_DOMAIN + SHOPIFY_ACCESS_TOKEN / client-credentials — server-side only.
 * Header: X-Shopify-Access-Token. Admin API version pinned to 2026-07.
 *
 * Auth model — storefront reads are open to any logged-in user; fulfillment +
 * billing actions are admin-only:
 *   shop / products / product / catalog / storefront  -> any user
 *   orders / order / createProduct                    -> admin only
 */

const VALID_ACTIONS = ["shop", "products", "product", "catalog", "storefront", "orders", "order", "createProduct"];

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

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'shopify_catalog_provider', priority:50, estimatedMs:5000, realtime:false, background:true, tags:['provider','scheduled'] });

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "").toLowerCase();
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json({ error: `Invalid action. Use one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
    }

    if ((action === "orders" || action === "order" || action === "createProduct") && user.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const shopifyAuth = await getShopifyAdminToken();
    const domain = shopifyAuth.domain;
    const token = shopifyAuth.token;
    // Demo/sandbox fallback only when no usable Shopify credential exists.
    if (!domain || !token) {
      return Response.json({ ...shopifyDemo(action, payload), shopify_auth_error: shopifyAuth.error || null });
    }

    const base = shopifyAdminBase(domain);

    // ----- Shop info -----
    if (action === "shop") {
      const r = await shoGet(`${base}/shop.json`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ shop: mapShopSummary(r.data?.shop || {}) });
    }

    // ----- Storefront bundle (shop identity + active catalog in one round-trip) -----
    if (action === "storefront") {
      const cap = Math.min(250, Math.max(1, Number(payload.limit) || 250));
      const [shopR, productsR] = await Promise.all([
        shoGet(`${base}/shop.json`, token),
        shoGet(`${base}/products.json?limit=${cap}`, token),
      ]);
      if (!shopR.ok) return Response.json({ error: shopR.error }, { status: shopR.status });
      if (!productsR.ok) return Response.json({ error: productsR.error }, { status: productsR.status });
      return Response.json(mapStorefront(shopR.data?.shop || {}, productsR.data));
    }

    // ----- Products list -----
    if (action === "products") {
      const limit = Math.min(250, Math.max(1, Number(payload.limit) || 50));
      const pageInfo = payload.page_info ? `&page_info=${encodeURIComponent(payload.page_info)}` : "";
      const r = await shoGet(`${base}/products.json?limit=${limit}${pageInfo}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const products = (r.data?.products || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
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
      const r = await shoGet(`${base}/products/${encodeURIComponent(id)}.json`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const p = r.data?.product || {};
      return Response.json({
        product: {
          id: p.id,
          title: p.title,
          handle: p.handle,
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
      const r = await shoGet(`${base}/products.json?limit=${cap}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      const products = (r.data?.products || []).map((p: any) => {
        const variants = (p.variants || []).map(variantSummary);
        const prices = variants.map((v: any) => Number(v.price)).filter((n: number) => !isNaN(n));
        return {
          id: p.id,
          title: p.title,
          handle: p.handle,
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
      const r = await shoGet(`${base}/orders.json?limit=${limit}${status}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ orders: mapOrders(r.data) });
    }

    // ----- Single order (admin-only) -----
    if (action === "order") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await shoGet(`${base}/orders/${encodeURIComponent(id)}.json`, token);
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
      const r = await shoPost(`${base}/products.json`, body, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ product: { id: r.data?.product?.id, title: r.data?.product?.title } });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("shopify-catalog error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}