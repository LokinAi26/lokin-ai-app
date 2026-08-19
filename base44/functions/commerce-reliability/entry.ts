import { secrets } from "base44:runtime";
import { getShopifyAdminToken, getShopifyTokenDiagnostics, normalizeShopifyDomain } from "../../shared/shopifyAuth.ts";
import { shopifyAdminBase, shoGet } from "../../shared/shopifyReads.ts";

/**
 * commerce-reliability — READ-ONLY Commerce Reliability Layer.
 *
 * Continuously validates the LOKIN commerce chain without performing any write,
 * order creation, charge, fulfillment, or inventory mutation:
 *   - Shopify authentication + token auto-renewal readiness
 *   - Printful authentication
 *   - Shopify <-> Printful connection status
 *   - Product synchronization + product/variant monitoring (unpublished, out of stock, SKU anomalies)
 *   - SKU / variant mapping
 *   - Fulfillment readiness (scopes + locations)
 *   - Inventory / availability (Shopify + Printful compatibility note)
 *   - Printful Store API compatibility (Shopify-platform 400 is EXPECTED, not an auth failure)
 *   - Tracking synchronization readiness
 *
 * Returns HEALTHY / WARNING / ACTION_REQUIRED per check and an overall status.
 * NEVER exposes tokens, access tokens, authorization headers, session JWTs, or
 * secrets in the response or logs. No customer PII is returned.
 */

const PRINTFUL_API = "https://api.printful.com";

function cleanToken(v: unknown): string {
  return String(v || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .trim();
}

async function pfGet(path: string, token: string, storeId: string) {
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (storeId) headers["X-PF-Store-Id"] = storeId;
    const r = await fetch(`${PRINTFUL_API}${path}`, { headers });
    let data: any = null;
    try { data = await r.json(); } catch { data = null; }
    return { ok: r.ok, status: r.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: String(e?.message || e) };
  }
}

const RANK: Record<string, number> = { HEALTHY: 0, WARNING: 1, ACTION_REQUIRED: 2 };
function worstStatus(checks: any[]): string {
  let w = "HEALTHY";
  for (const c of checks) if (RANK[c.status] > RANK[w]) w = c.status;
  return w;
}
function skuLooksPrintful(sku: unknown): boolean {
  return Boolean(sku) && /^\d+[_-]\d+$/.test(String(sku));
}

export default async function (req: Request): Promise<Response> {
  const checks: any[] = [];
  const checkedAt = new Date().toISOString();

  // ---- Shopify authentication ----
  const diag = await getShopifyTokenDiagnostics();
  const auth = await getShopifyAdminToken();
  let shopifyShop: any = null;
  if (auth.token) {
    const base = shopifyAdminBase(auth.domain);
    const r = await shoGet(`${base}/shop.json`, auth.token);
    if (r.ok) shopifyShop = r.data?.shop || null;
    checks.push({
      key: "shopify_auth",
      label: "Shopify authentication",
      status: r.ok ? "HEALTHY" : "ACTION_REQUIRED",
      detail: r.ok
        ? `Connected to ${shopifyShop?.name || auth.domain} via ${auth.source}.`
        : auth.error || `Shopify read failed (HTTP ${r.status}).`,
      domain: auth.domain,
      token_source: auth.source,
      scope: auth.scope || null,
      shop_name: shopifyShop?.name || null,
    });
  } else {
    checks.push({
      key: "shopify_auth",
      label: "Shopify authentication",
      status: "ACTION_REQUIRED",
      detail: auth.error || "No Shopify token available.",
      domain: auth.domain,
      token_source: auth.source,
    });
  }

  // ---- Shopify token auto-renewal ----
  if (diag.source === "client_credentials") {
    const hoursLeft = diag.expiresAt ? (diag.expiresAt - Date.now()) / 3_600_000 : null;
    checks.push({
      key: "shopify_token_renewal",
      label: "Shopify token auto-renewal",
      status: diag.exchangeError ? "ACTION_REQUIRED" : diag.renewalWarning ? "WARNING" : "HEALTHY",
      detail: diag.exchangeError
        ? `Renewal unavailable: ${diag.exchangeError}`
        : hoursLeft != null
          ? `Client-credentials token auto-renews; ~${Math.max(0, Math.round(hoursLeft))}h remaining.`
          : "Client-credentials token auto-renews.",
      renewable: true,
      expires_at: diag.expiresAt ? new Date(diag.expiresAt).toISOString() : null,
      hours_left: hoursLeft != null ? Math.round(hoursLeft) : null,
    });
  } else {
    checks.push({
      key: "shopify_token_renewal",
      label: "Shopify token auto-renewal",
      status: diag.source === "static" ? "WARNING" : "ACTION_REQUIRED",
      detail:
        diag.source === "static"
          ? "Using a legacy static token with no auto-renewal. Configure SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET for automatic renewal."
          : "No Shopify credentials configured.",
      renewable: false,
    });
  }

  // ---- Printful authentication ----
  const pfToken = cleanToken(secrets.get("PRINTFUL_API_TOKEN"));
  let pfStores: any[] = [];
  let pfError: string | null = null;
  if (pfToken) {
    const r = await pfGet("/stores", pfToken, "");
    if (r.ok && Array.isArray(r.data?.result)) pfStores = r.data.result;
    else pfError = r.data?.error?.message || r.data?.error?.reason || (typeof r.data?.result === "string" ? r.data.result : null) || `Printful /stores failed (HTTP ${r.status}).`;
  }
  const pfStore = pfStores[0] || null;
  checks.push({
    key: "printful_auth",
    label: "Printful authentication",
    status: pfStore ? "HEALTHY" : "ACTION_REQUIRED",
    detail: pfStore
      ? `Printful token valid; store "${pfStore.name}" (type ${pfStore.type}).`
      : pfToken
        ? pfError || "Printful token rejected."
        : "PRINTFUL_API_TOKEN not configured.",
    store_type: pfStore?.type || null,
    store_count: pfStores.length,
  });

  // ---- Shopify <-> Printful connection ----
  const pfShopifyType = pfStore && String(pfStore.type || "").toLowerCase() === "shopify";
  checks.push({
    key: "shopify_printful_connection",
    label: "Shopify → Printful connection",
    status: shopifyShop && pfShopifyType ? "HEALTHY" : shopifyShop && pfStore ? "WARNING" : "ACTION_REQUIRED",
    detail:
      shopifyShop && pfShopifyType
        ? "Printful store is Shopify-platform linked; native sync architecture active."
        : pfStore
          ? "Printful connected, but store type is not Shopify-platform; sync may be manual."
          : "Printful not connected.",
  });

  // ---- Product synchronization ----
  let products: any[] = [];
  if (auth.token) {
    const base = shopifyAdminBase(auth.domain);
    const r = await shoGet(`${base}/products.json?limit=250`, auth.token);
    if (r.ok) products = r.data?.products || [];
    checks.push({
      key: "product_sync",
      label: "Product synchronization",
      status: r.ok ? (products.length ? "HEALTHY" : "WARNING") : "ACTION_REQUIRED",
      detail: r.ok ? `${products.length} Shopify product(s) readable.` : `Shopify product read failed (HTTP ${r.status}).`,
      product_count: products.length,
    });
  } else {
    checks.push({ key: "product_sync", label: "Product synchronization", status: "ACTION_REQUIRED", detail: "No Shopify token; cannot read products." });
  }

  // ---- Product & variant monitoring + SKU/variant mapping ----
  if (products.length) {
    const flagged: any[] = [];
    let variantsTotal = 0;
    let mapped = 0;
    for (const p of products) {
      const issues: string[] = [];
      if (p.status !== "active") issues.push("unpublished");
      const vars: any[] = p.variants || [];
      for (const v of vars) {
        variantsTotal++;
        if (skuLooksPrintful(v.sku)) mapped++;
        else issues.push("sku_anomaly");
        if (v.inventory_management != null && v.inventory_quantity === 0) issues.push("out_of_stock");
        if (v.inventory_quantity != null && v.inventory_quantity > 0 && v.inventory_quantity <= 5) issues.push("low_stock");
      }
      if (issues.length) flagged.push({ id: p.id, title: p.title, status: p.status, issues: [...new Set(issues)] });
    }
    checks.push({
      key: "product_monitoring",
      label: "Product & variant monitoring",
      status: flagged.length ? "WARNING" : "HEALTHY",
      detail: flagged.length ? `${flagged.length} product(s) need attention (unpublished / out of stock / SKU anomaly).` : "All published products and variants look healthy.",
      flagged_count: flagged.length,
      flagged: flagged.slice(0, 20),
    });
    checks.push({
      key: "sku_variant_mapping",
      label: "SKU / variant mapping",
      status: variantsTotal ? (mapped === 0 ? "ACTION_REQUIRED" : mapped === variantsTotal ? "HEALTHY" : "WARNING") : "WARNING",
      detail: `${mapped}/${variantsTotal} variant(s) carry Printful-format SKUs. Unmapped variants may be non-Printful products — review if they should be Printful-linked.`,
      variants: variantsTotal,
      mapped,
    });
  }

  // ---- Fulfillment readiness ----
  if (auth.token) {
    const base = shopifyAdminBase(auth.domain);
    const locRes = await shoGet(`${base}/locations.json`, auth.token);
    const scope = (auth.scope || "").split(",").map((s) => s.trim());
    const need = ["write_merchant_managed_fulfillment_orders", "write_orders", "read_locations"];
    const missing = need.filter((s) => !scope.includes(s));
    checks.push({
      key: "fulfillment_readiness",
      label: "Fulfillment readiness",
      status: locRes.ok && !missing.length ? "HEALTHY" : locRes.ok && missing.length ? "WARNING" : "ACTION_REQUIRED",
      detail: locRes.ok
        ? `Fulfillment API reachable; ${locRes.data?.locations?.length || 0} location(s).${missing.length ? ` Missing scopes: ${missing.join(", ")}.` : ""}`
        : `Locations read failed (HTTP ${locRes.status}).`,
      missing_scopes: missing,
    });
  }

  // ---- Inventory / availability ----
  let inStock = 0, low = 0, out = 0, untracked = 0;
  for (const p of products) for (const v of p.variants || []) {
    const q = v.inventory_quantity;
    if (q == null) untracked++;
    else if (q === 0) out++;
    else if (q <= 5) low++;
    else inStock++;
  }
  const pfAvailNote = pfStore && pfShopifyType
    ? "Printful availability is managed via the native Shopify integration (expected for Shopify-platform stores)."
    : pfStore
      ? "Printful availability readable via Store API."
      : "Printful availability not probed (no Printful store).";
  checks.push({
    key: "inventory_availability",
    label: "Inventory / availability",
    status: "HEALTHY",
    detail: `Shopify inventory: ${inStock} in stock, ${low} low, ${out} out, ${untracked} untracked. ${pfAvailNote}`,
    in_stock: inStock,
    low_stock: low,
    out_of_stock: out,
    untracked,
  });

  // ---- Printful Store API compatibility (the 400 case is EXPECTED for shopify-platform stores) ----
  if (pfStore) {
    const r = await pfGet("/store/products?limit=1", pfToken, String(pfStore.id));
    const msg = r.data?.error?.message || (typeof r.data?.result === "string" ? r.data.result : null);
    const expectedCompat = r.status === 400 && Boolean(msg) && /Manual Order|API platform/i.test(msg);
    checks.push({
      key: "printful_store_api_compatibility",
      label: "Printful Store API compatibility",
      status: expectedCompat ? "HEALTHY" : r.ok ? "HEALTHY" : r.status === 401 || r.status === 403 ? "ACTION_REQUIRED" : "WARNING",
      detail: expectedCompat
        ? "Shopify-platform store: Printful Store product API returns the expected compatibility response (not an authentication failure)."
        : r.ok
          ? "Printful Store product API readable."
          : `Printful Store API returned HTTP ${r.status}: ${msg || "unexpected response"}.`,
      http_status: r.status,
      expected_compatibility: expectedCompat,
    });
  }

  // ---- Tracking synchronization readiness (no customer PII returned) ----
  if (auth.token) {
    const base = shopifyAdminBase(auth.domain);
    const r = await shoGet(`${base}/orders.json?limit=1&fields=id,name,fulfillment_status,total_price,created_at`, auth.token);
    checks.push({
      key: "tracking_sync_readiness",
      label: "Tracking synchronization readiness",
      status: r.ok ? "HEALTHY" : "ACTION_REQUIRED",
      detail: r.ok
        ? "Shopify orders endpoint reachable; fulfillment tracking can be synchronized."
        : `Orders read failed (HTTP ${r.status}).`,
    });
  }

  const overall = worstStatus(checks);
  return Response.json({ overall, checked_at: checkedAt, checks });
}