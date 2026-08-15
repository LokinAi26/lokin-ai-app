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
      if (!stores.length) {
        result.printful = { connected: false, store_count: 0, error: "Printful token works, but no store is attached to it." };
      } else {
        const store = stores[0];
        const catalogProbe = await safeJson("https://api.printful.com/store/products?limit=1", {
          headers: {
            Authorization: `Bearer ${printfulToken}`,
            "Content-Type": "application/json",
            "X-PF-Store-Id": String(store.id),
          },
        });
        if (catalogProbe.ok) {
          result.printful = {
            connected: true,
            store_count: stores.length,
            catalog_readable: true,
            store: { id: store.id, name: store.name, type: store.type },
          };
        } else {
          result.printful = {
            connected: false,
            store_count: stores.length,
            catalog_readable: false,
            status: catalogProbe.status,
            store: { id: store.id, name: store.name, type: store.type },
            error: catalogProbe.data?.error?.message || catalogProbe.data?.error?.reason || (typeof catalogProbe.data?.result === "string" ? catalogProbe.data.result : null) || catalogProbe.data?.message || "Printful token can list stores but cannot read sync products. Recreate the token with sync_products/read access.",
          };
        }
      }
    } else {
      result.printful = { connected: false, status: r.status, error: r.data?.error?.message || r.data?.error?.reason || (typeof r.data?.result === "string" ? r.data.result : null) || r.data?.error || "Printful check failed" };
    }
  } else {
    // No real token -> storefront falls back to demo/sandbox data.
    result.printful = { connected: false, mode: "demo", error: "PRINTFUL_API_TOKEN missing — serving demo data" };
  }

  const printifyToken = secrets.get("PRINTIFY_API_TOKEN");
  if (printifyToken) {
    const r = await safeJson("https://api.printify.com/v1/shops.json", {
      headers: { Authorization: `Bearer ${printifyToken}` },
    });
    if (r.ok) {
      const shops = Array.isArray(r.data) ? r.data : [];
      result.printify = shops.length
        ? {
            connected: true,
            shop_count: shops.length,
            shop: { id: shops[0].id, title: shops[0].title, sales_channel: shops[0].sales_channel },
          }
        : { connected: false, shop_count: 0, error: "Printify token works, but no shop is attached to it." };
    } else {
      result.printify = { connected: false, status: r.status, error: r.data?.message || r.data?.error || "Printify check failed" };
    }
  } else {
    result.printify = { connected: false, mode: "demo", error: "PRINTIFY_API_TOKEN missing — serving demo data" };
  }

  const rawShopifyDomain = secrets.get("SHOPIFY_STORE_DOMAIN");
  const shopifyToken = secrets.get("SHOPIFY_ACCESS_TOKEN");
  const shopifyDomain = String(rawShopifyDomain || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (shopifyDomain && shopifyToken) {
    const r = await safeJson(`https://${shopifyDomain}/admin/api/2024-07/shop.json`, {
      headers: { "X-Shopify-Access-Token": shopifyToken, "Content-Type": "application/json" },
    });
    if (r.ok) {
      const s = r.data?.shop || {};
      result.shopify = { connected: true, shop: { id: s.id, name: s.name, domain: s.domain, currency: s.currency } };
    } else {
      result.shopify = { connected: false, status: r.status, error: r.data?.errors || r.data?.error || "Shopify check failed" };
    }
  } else {
    result.shopify = { connected: false, mode: "demo", error: "SHOPIFY credentials missing — serving demo data" };
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