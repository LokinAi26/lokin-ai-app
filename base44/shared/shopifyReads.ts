// Shared Shopify Admin REST read helpers used by shopify-catalog and shopify-embed.
// Plain module — no Deno.serve.

import { jsonRequest } from "./printRequest.ts";
import { normalizeShopifyDomain } from "./shopifyAuth.ts";

export const SHOPIFY_API_VERSION = "2026-07";

export function shopifyAdminBase(domain: string): string {
  return `https://${normalizeShopifyDomain(domain)}/admin/api/${SHOPIFY_API_VERSION}`;
}

export async function shoGet(path: string, token: string) {
  const r = await jsonRequest({ url: path, headers: { "X-Shopify-Access-Token": token } });
  if (!r.ok) return { ok: false as const, status: r.status, error: r.error };
  return { ok: true as const, data: r.data };
}

export function variantSummary(v: any) {
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

export function mapShopSummary(s: any) {
  return {
    id: s.id,
    name: s.name,
    domain: s.domain,
    currency: s.currency,
    country: s.country,
    plan: s.plan_name,
  };
}

export function mapStorefront(s: any, productsData: any) {
  const products = (productsData?.products || []).map((p: any) => {
    const variants = (p.variants || []).map(variantSummary);
    const prices = variants.map((v: any) => Number(v.price)).filter((n: number) => !isNaN(n));
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail_url: p.image?.src,
      images: (p.images || []).map((img: any) => img.src).filter(Boolean),
      description: String(p.body_html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      vendor: p.vendor,
      product_type: p.product_type,
      options: p.options || [],
      status: p.status,
      variants,
      min_price: prices.length ? Math.min(...prices).toFixed(2) : null,
      max_price: prices.length ? Math.max(...prices).toFixed(2) : null,
      currency: s.currency || "USD",
    };
  });
  return {
    shop: { id: s.id, name: s.name, domain: s.domain, currency: s.currency, country: s.country },
    products,
    count: products.length,
  };
}

export function mapOrders(ordersData: any) {
  return (ordersData?.orders || []).map((o: any) => ({
    id: o.id,
    name: o.name,
    financial_status: o.financial_status,
    fulfillment_status: o.fulfillment_status,
    total_price: o.total_price,
    currency: o.currency,
    customer: o.customer
      ? { email: o.customer.email, name: `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() }
      : null,
    created_at: o.created_at,
    items_count: (o.line_items || []).length,
  }));
}

export function mapDrafts(data: any) {
  return (data?.draft_orders || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    total_price: d.total_price,
    currency: d.currency,
    customer_email: d.customer?.email || d.email || "",
    customer_name: d.customer
      ? `${d.customer.first_name || ""} ${d.customer.last_name || ""}`.trim()
      : "",
    invoice_url: d.invoice_url,
    created_at: d.created_at,
    items_count: (d.line_items || []).length,
  }));
}

export function mapOrdersRich(ordersData: any) {
  return (ordersData?.orders || []).map((o: any) => {
    const fulfillments = (o.fulfillments || []).map((f: any) => ({
      id: f.id,
      status: f.status,
      tracking_number: f.tracking_number,
      tracking_url: f.tracking_url,
      carrier: f.tracking_company || f.tracking_carrier || "",
      created_at: f.created_at,
    }));
    return {
      id: o.id,
      name: o.name,
      financial_status: o.financial_status,
      fulfillment_status: o.fulfillment_status,
      test: o.test === true,
      total_price: o.total_price,
      subtotal_price: o.subtotal_price,
      total_tax: o.total_tax,
      currency: o.currency,
      created_at: o.created_at,
      refunds: (o.refunds || []).length,
      customer: o.customer
        ? {
            id: o.customer.id,
            email: o.customer.email,
            name: `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim(),
          }
        : null,
      line_items: (o.line_items || []).map((it: any) => ({
        title: it.title,
        sku: it.sku,
        quantity: it.quantity,
        price: it.price,
        product_id: it.product_id,
        variant_id: it.variant_id,
      })),
      fulfillments,
      tracking_number: fulfillments[0]?.tracking_number || null,
      tracking_url: fulfillments[0]?.tracking_url || null,
      items_count: (o.line_items || []).length,
    };
  });
}