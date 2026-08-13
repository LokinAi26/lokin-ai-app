import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

async function safeJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = {
    printful: { connected: false },
    printify: { connected: false },
    shopify: { connected: false },
    gmail: { connected: false },
  };

  const printfulToken = secrets.get("PRINTFUL_API_TOKEN");
  if (printfulToken) {
    const r = await safeJson("https://api.printful.com/stores", {
      headers: { Authorization: `Bearer ${printfulToken}`, "Content-Type": "application/json" },
    });
    if (r.ok) {
      const stores = Array.isArray(r.data?.result) ? r.data.result : [];
      result.printful = {
        connected: true,
        store_count: stores.length,
        store: stores[0] ? { id: stores[0].id, name: stores[0].name, type: stores[0].type } : null,
      };
    } else {
      result.printful = { connected: false, status: r.status, error: r.data?.error?.message || r.data?.error || "Printful check failed" };
    }
  } else {
    result.printful = { connected: false, error: "PRINTFUL_API_TOKEN missing" };
  }

  const printifyToken = secrets.get("PRINTIFY_API_TOKEN");
  if (printifyToken) {
    const r = await safeJson("https://api.printify.com/v1/shops.json", {
      headers: { Authorization: `Bearer ${printifyToken}` },
    });
    if (r.ok) {
      const shops = Array.isArray(r.data) ? r.data : [];
      result.printify = {
        connected: true,
        shop_count: shops.length,
        shop: shops[0] ? { id: shops[0].id, title: shops[0].title, sales_channel: shops[0].sales_channel } : null,
      };
    } else {
      result.printify = { connected: false, status: r.status, error: r.data?.message || r.data?.error || "Printify check failed" };
    }
  } else {
    result.printify = { connected: false, error: "PRINTIFY_API_TOKEN missing" };
  }

  const shopifyDomain = secrets.get("SHOPIFY_STORE_DOMAIN");
  const shopifyToken = secrets.get("SHOPIFY_ACCESS_TOKEN");
  if (shopifyDomain && shopifyToken) {
    const r = await safeJson(`https://${shopifyDomain}/admin/api/2026-07/shop.json`, {
      headers: { "X-Shopify-Access-Token": shopifyToken, "Content-Type": "application/json" },
    });
    if (r.ok) {
      const s = r.data?.shop || {};
      result.shopify = { connected: true, shop: { id: s.id, name: s.name, domain: s.domain, currency: s.currency } };
    } else {
      result.shopify = { connected: false, status: r.status, error: r.data?.errors || r.data?.error || "Shopify check failed" };
    }
  } else {
    result.shopify = { connected: false, error: "SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN missing" };
  }

  try {
    const conn = await base44.asServiceRole.connectors.getConnection("gmail");
    result.gmail = { connected: Boolean(conn?.accessToken) };
  } catch (error) {
    result.gmail = { connected: false, error: error.message };
  }

  const connectedCount = Object.values(result).filter((v) => v.connected).length;
  return Response.json({ services: result, connected_count: connectedCount, all_connected: connectedCount === 4 });
}
