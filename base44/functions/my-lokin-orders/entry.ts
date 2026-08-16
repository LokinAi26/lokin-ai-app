import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { jsonRequest } from "../../shared/printRequest.ts";

const API_VERSION = "2026-07";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const domain = secrets.get("SHOPIFY_STORE_DOMAIN");
    const token = secrets.get("SHOPIFY_ACCESS_TOKEN");
    if (!domain || !token) return Response.json({ orders: [], live: false });

    const url = `https://${domain}/admin/api/${API_VERSION}/orders.json?status=any&limit=100`;
    const r = await jsonRequest({ url, headers: { "X-Shopify-Access-Token": token } });
    if (!r.ok) return Response.json({ error: "Order service temporarily unavailable" }, { status: 503 });

    const email = String(user.email).trim().toLowerCase();
    const orders = (r.data?.orders || [])
      .filter((o) => String(o.email || o.customer?.email || "").trim().toLowerCase() === email)
      .map((o) => ({
        id: o.id, name: o.name, created_at: o.created_at, currency: o.currency,
        total_price: o.total_price, financial_status: o.financial_status,
        fulfillment_status: o.fulfillment_status || "unfulfilled",
        items: (o.line_items || []).map((i) => ({ title: i.title, variant_title: i.variant_title, quantity: i.quantity, price: i.price })),
        fulfillments: (o.fulfillments || []).map((f) => ({
          status: f.status, created_at: f.created_at, tracking_company: f.tracking_company,
          tracking_numbers: f.tracking_numbers || (f.tracking_number ? [f.tracking_number] : []),
          tracking_urls: f.tracking_urls || (f.tracking_url ? [f.tracking_url] : []),
        })),
      }));

    return Response.json({ orders, count: orders.length, live: true });
  } catch (e) {
    console.error("my-lokin-orders error", e);
    return Response.json({ error: "Unable to load your orders" }, { status: 500 });
  }
}
