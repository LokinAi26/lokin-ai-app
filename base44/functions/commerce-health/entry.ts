import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { getShopifyAdminToken } from "../../shared/shopifyAuth.ts";

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
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'commerce_health', priority:35, estimatedMs:5000, realtime:false, background:true, tags:['provider','scheduled'] });

  const result = {
    printful: { connected: false },
    printify: { connected: false },
    shopify: { connected: false },
    gmail: { connected: false },
  };

  const rawPrintfulToken = secrets.get("PRINTFUL_API_TOKEN");
  const printfulToken = String(rawPrintfulToken || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^['\"]|['\"]$/g, "")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .trim();
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
        // A successful /stores response proves the token is valid. Some
        // platform-backed Printful stores reject legacy sync-product endpoints,
        // so capability probing must not falsely mark the whole connection red.
        result.printful = {
          connected: true,
          store_count: stores.length,
          catalog_readable: null,
          store: { id: store.id, name: store.name, type: store.type },
          note: String(store.type || "").toLowerCase().includes("api") || String(store.type || "").toLowerCase().includes("manual")
            ? "Printful credential validated."
            : "Printful credential validated; storefront catalog is expected to come from the connected commerce platform.",
        };
      }
    } else {
      result.printful = { connected: false, status: r.status, error: r.data?.error?.message || r.data?.error?.reason || (typeof r.data?.result === "string" ? r.data.result : null) || r.data?.error || "Printful check failed" };
    }
  } else {
    // No real token -> storefront falls back to demo/sandbox data.
    result.printful = { connected: false, mode: "demo", error: "PRINTFUL_API_TOKEN missing — serving demo data" };
  }

  const rawPrintifyToken = secrets.get("PRINTIFY_API_TOKEN");
  const printifyToken = String(rawPrintifyToken || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^['\"]|['\"]$/g, "")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .trim();
  if (printifyToken) {
    const r = await safeJson("https://api.printify.com/v1/shops.json", {
      headers: {
        Authorization: `Bearer ${printifyToken}`,
        Accept: "application/json",
        "User-Agent": "LOKIN-AI-Base44/1.0",
      },
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
      const raw = r.data?.message || r.data?.error || "Printify check failed";
      const parts = printifyToken.split(".");
      let tokenAlg = null;
      try {
        if (parts[0]) {
          const padded = parts[0].replace(/-/g, "+").replace(/_/g, "/") + "===".slice((parts[0].length + 3) % 4);
          const header = JSON.parse(atob(padded));
          tokenAlg = header?.alg || null;
        }
      } catch {}
      const looksLikeSignedJwt = tokenAlg && String(tokenAlg).toLowerCase() !== "none";
      const missingJwtSignature = looksLikeSignedJwt && parts.length === 2;
      result.printify = {
        connected: false,
        status: r.status,
        token_received: true,
        token_length: printifyToken.length,
        token_segments: parts.length,
        token_segment_lengths: parts.map((p) => p.length),
        token_alg: tokenAlg,
        token_shape_ok: !looksLikeSignedJwt || parts.length === 3,
        missing_signature: missingJwtSignature,
        error: r.status === 401
          ? (missingJwtSignature
              ? `Printify credential is incomplete: it declares ${tokenAlg} signing but contains only 2 token segments. Generate a new Personal Access Token and use Printify's Copy to clipboard button so the signature segment is included.`
              : "Printify rejected the credential. The request format is correct; verify the Personal Access Token is current and has shops.read access.")
          : raw,
      };
    }
  } else {
    result.printify = { connected: false, mode: "demo", error: "PRINTIFY_API_TOKEN missing — serving demo data" };
  }

  const shopifyAuth = await getShopifyAdminToken();
  const shopifyDomain = shopifyAuth.domain;
  const shopifyToken = shopifyAuth.token;
  if (shopifyDomain && shopifyToken) {
    const r = await safeJson(`https://${shopifyDomain}/admin/api/2026-07/shop.json`, {
      headers: { "X-Shopify-Access-Token": shopifyToken, "Content-Type": "application/json", Accept: "application/json" },
    });
    if (r.ok) {
      const s = r.data?.shop || {};
      result.shopify = {
        connected: true,
        auth_source: shopifyAuth.source,
        tested_domain: shopifyDomain,
        scope: shopifyAuth.scope || null,
        token_expires_at: shopifyAuth.expiresAt ? new Date(shopifyAuth.expiresAt).toISOString() : null,
        shop: { id: s.id, name: s.name, domain: s.domain, myshopify_domain: s.myshopify_domain, currency: s.currency },
      };
    } else {
      const apiError = r.data?.errors || r.data?.error || "Shopify check failed";
      result.shopify = {
        connected: false,
        status: r.status,
        auth_source: shopifyAuth.source,
        auth_exchange_status: shopifyAuth.status || null,
        auth_exchange_error: shopifyAuth.error || null,
        tested_domain: shopifyDomain,
        domain_is_myshopify: shopifyDomain.endsWith(".myshopify.com"),
        error: r.status === 404
          ? `Shopify store not found at ${shopifyDomain}. SHOPIFY_STORE_DOMAIN must be the permanent *.myshopify.com domain.`
          : r.status === 401
            ? (shopifyAuth.source === "static"
                ? "Shopify rejected the legacy static Admin API token. The client-credentials exchange is not active yet; release and install the LOKIN AI Commerce app on this store."
                : "Shopify rejected the freshly exchanged Admin API access token. Verify the released app version and scopes.")
            : r.status === 403
              ? "Shopify authenticated the app but the released version lacks permission for this request."
              : apiError,
      };
    }
  } else {
    result.shopify = {
      connected: false,
      mode: "setup",
      auth_source: shopifyAuth.source,
      auth_exchange_status: shopifyAuth.status || null,
      error: shopifyAuth.error || "Shopify credentials missing.",
    };
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