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