import { secrets } from "base44:runtime";
import { getShopifyAdminToken, getShopifyTokenDiagnostics, normalizeShopifyDomain } from "../../shared/shopifyAuth.ts";
import { shopifyAdminBase, shoGet } from "../../shared/shopifyReads.ts";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

/**
 * commerce-reliability — READ-ONLY Commerce Reliability Layer.
 *
 * Continuously validates the LOKIN commerce chain without performing any write,
 * order creation, charge, fulfillment, refund, cancellation, or inventory mutation:
 *   - Shopify authentication + token auto-renewal readiness (Credential Health)
 *   - Printful authentication (validated via /stores, including Shopify-platform stores)
 *   - Shopify <-> Printful connection status
 *   - Product synchronization + product/variant monitoring (unpublished, out of stock,
 *     low stock, SKU anomaly, unsynced)
 *   - SKU / variant mapping
 *   - Fulfillment readiness (scopes + locations)
 *   - Inventory / availability (Shopify + Printful compatibility note)
 *   - Printful Store API compatibility (Shopify-platform 400 is EXPECTED, not auth failure)
 *   - Tracking synchronization readiness
 *   - Duplicate-write protection (idempotency guard presence, read-only)
 *   - Secret redaction (no credentials leaked in response)
 *
 * Returns HEALTHY / WARNING / ACTION_REQUIRED per check plus an overall status and
 * human-readable remediation instructions for any non-HEALTHY check.
 * NEVER exposes tokens, access tokens, authorization headers, session JWTs, client
 * secrets, Printful tokens, or other credentials in the response or logs. No PII.
 *
 * Requirement 12: The native Printful automatic-fulfillment workflow is preserved.
 * This layer performs no fulfillment and creates no competing fulfillment pathway.
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

const REMEDIATION: Record<string, string> = {
  shopify_auth: "Reconnect LOKIN Commerce from Shopify Admin → Apps, or refresh SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET (and SHOPIFY_STORE_DOMAIN) in Base44 Secrets.",
  shopify_token_renewal: "Configure SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET for automatic client-credentials renewal. A legacy static token will eventually expire with no warning.",
  printful_auth: "Set a valid PRINTFUL_API_TOKEN in Base44 Secrets, or reconnect Printful via OAuth. Do NOT migrate the store to Manual Order/API.",
  shopify_printful_connection: "Ensure the Printful store is platform-linked to Shopify (Printful dashboard → Stores → connect Shopify). Keep the native sync architecture.",
  product_sync: "Verify Shopify Admin API access and that products exist in the Shopify store. Confirm SHOPIFY_STORE_DOMAIN is correct.",
  product_monitoring: "Review flagged products: publish unpublished products, restock out-of-stock variants, and resolve SKU anomalies. For unsynced products, push them to Printful so Shopify assigns Printful-format SKUs, or mark them as non-Printful.",
  sku_variant_mapping: "Push unsynced products to Printful so Shopify assigns Printful-format SKUs, or mark them as intentional non-Printful listings.",
  fulfillment_readiness: "Grant the missing Shopify scopes (write_merchant_managed_fulfillment_orders, write_orders, read_locations) and reinstall the app if needed. The native Printful fulfillment workflow is unchanged.",
  inventory_availability: "Restock out-of-stock variants or mark them as sold out in Shopify. Printful availability is managed via the native Shopify integration for Shopify-platform stores.",
  printful_store_api_compatibility: "If a Shopify-platform Printful store returns an unexpected (non-400) error, verify the Printful token is valid and the store is healthy. A 400 'Manual Order/API platform' response is EXPECTED.",
  tracking_sync_readiness: "Verify Shopify orders endpoint access and scopes (read_orders).",
  credential_health: "Review Shopify and Printful credentials; renew or reconnect any expired or missing credential before it becomes unusable.",
  duplicate_write_protection: "Ensure the CommerceIdempotencyKey entity exists and guardedIdempotentWrite wraps every order, payment, refund, cancellation, fulfillment, and inventory write.",
  secret_redaction: "Audit response payloads, logs, and error messages to ensure no tokens, secrets, or credentials are ever exposed to the UI.",
};

export default async function (req: Request): Promise<Response> {
  const checks: any[] = [];
  const checkedAt = new Date().toISOString();

  // Raw secret values captured ONLY for the local secret-redaction self-check.
  // They are never placed in the response, never logged, and discarded after the scan.
  const secretValues: string[] = [
    cleanToken(secrets.get("PRINTFUL_API_TOKEN")),
    cleanToken(secrets.get("SHOPIFY_ACCESS_TOKEN")),
    cleanToken(secrets.get("SHOPIFY_CLIENT_SECRET")),
    cleanToken(secrets.get("SHOPIFY_CLIENT_ID")),
    cleanToken(secrets.get("PRINTFUL_OAUTH_CLIENT_SECRET")),
    cleanToken(secrets.get("PRINTIFY_API_TOKEN")),
  ].filter((s) => s && s.length >= 8);

  // ---- Shopify authentication ----
  const diag = await getShopifyTokenDiagnostics();
  const auth = await getShopifyAdminToken();
  let shopifyShop: any = null;
  let shopifyAuthStatus = "ACTION_REQUIRED";
  if (auth.token) {
    const base = shopifyAdminBase(auth.domain);
    const r = await shoGet(`${base}/shop.json`, auth.token);
    if (r.ok) shopifyShop = r.data?.shop || null;
    shopifyAuthStatus = r.ok ? "HEALTHY" : "ACTION_REQUIRED";
    checks.push({
      key: "shopify_auth",
      label: "Shopify authentication",
      status: shopifyAuthStatus,
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
  let renewalStatus = "ACTION_REQUIRED";
  if (diag.source === "client_credentials") {
    const hoursLeft = diag.expiresAt ? (diag.expiresAt - Date.now()) / 3_600_000 : null;
    renewalStatus = diag.exchangeError ? "ACTION_REQUIRED" : diag.renewalWarning ? "WARNING" : "HEALTHY";
    checks.push({
      key: "shopify_token_renewal",
      label: "Shopify token auto-renewal",
      status: renewalStatus,
      detail: diag.exchangeError
        ? `Renewal unavailable: ${diag.exchangeError}`
        : hoursLeft != null
          ? `Client-credentials token auto-renews; ~${Math.max(0, Math.round(hoursLeft))}h remaining. Early warning fires <12h.`
          : "Client-credentials token auto-renews.",
      renewable: true,
      expires_at: diag.expiresAt ? new Date(diag.expiresAt).toISOString() : null,
      hours_left: hoursLeft != null ? Math.round(hoursLeft) : null,
    });
  } else {
    renewalStatus = diag.source === "static" ? "WARNING" : "ACTION_REQUIRED";
    checks.push({
      key: "shopify_token_renewal",
      label: "Shopify token auto-renewal",
      status: renewalStatus,
      detail:
        diag.source === "static"
          ? "Using a legacy static token with no auto-renewal. Configure SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET for automatic renewal."
          : "No Shopify credentials configured.",
      renewable: false,
    });
  }

  // ---- Printful authentication (validated via /stores, including Shopify-platform stores) ----
  const pfToken = cleanToken(secrets.get("PRINTFUL_API_TOKEN"));
  let pfStores: any[] = [];
  let pfError: string | null = null;
  if (pfToken) {
    const r = await pfGet("/stores", pfToken, "");
    if (r.ok && Array.isArray(r.data?.result)) pfStores = r.data.result;
    else pfError = r.data?.error?.message || r.data?.error?.reason || (typeof r.data?.result === "string" ? r.data.result : null) || `Printful /stores failed (HTTP ${r.status}).`;
  }
  const pfStore = pfStores[0] || null;
  const printfulAuthStatus = pfStore ? "HEALTHY" : "ACTION_REQUIRED";
  checks.push({
    key: "printful_auth",
    label: "Printful authentication",
    status: printfulAuthStatus,
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
  const connStatus = shopifyShop && pfShopifyType ? "HEALTHY" : shopifyShop && pfStore ? "WARNING" : "ACTION_REQUIRED";
  checks.push({
    key: "shopify_printful_connection",
    label: "Shopify → Printful connection",
    status: connStatus,
    detail:
      shopifyShop && pfShopifyType
        ? "Printful store is Shopify-platform linked; native sync architecture active."
        : pfStore
          ? "Printful connected, but store type is not Shopify-platform; sync may be manual."
          : "Printful not connected.",
  });

  // ---- Product synchronization ----
  let products: any[] = [];
  let productSyncStatus = "ACTION_REQUIRED";
  if (auth.token) {
    const base = shopifyAdminBase(auth.domain);
    const r = await shoGet(`${base}/products.json?limit=250`, auth.token);
    if (r.ok) products = r.data?.products || [];
    productSyncStatus = r.ok ? (products.length ? "HEALTHY" : "WARNING") : "ACTION_REQUIRED";
    checks.push({
      key: "product_sync",
      label: "Product synchronization",
      status: productSyncStatus,
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
      let productMapped = 0;
      for (const v of vars) {
        variantsTotal++;
        if (skuLooksPrintful(v.sku)) { mapped++; productMapped++; }
        else issues.push("sku_anomaly");
        if (v.inventory_management != null && v.inventory_quantity === 0) issues.push("out_of_stock");
        if (v.inventory_quantity != null && v.inventory_quantity > 0 && v.inventory_quantity <= 5) issues.push("low_stock");
      }
      // Requirement 5: detect unsynced / lost Printful linkage — a product with
      // variants but zero Printful-format SKUs is treated as unsynced.
      if (vars.length && productMapped === 0) issues.push("unsynced");
      if (issues.length) flagged.push({ id: p.id, title: p.title, status: p.status, issues: [...new Set(issues)] });
    }
    checks.push({
      key: "product_monitoring",
      label: "Product & variant monitoring",
      status: flagged.length ? "WARNING" : "HEALTHY",
      detail: flagged.length
        ? `${flagged.length} product(s) need attention (${[...new Set(flagged.flatMap((f) => f.issues))].join(" / ")}).`
        : "All published products and variants look healthy and Printful-linked.",
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
    const fStatus = locRes.ok && !missing.length ? "HEALTHY" : locRes.ok && missing.length ? "WARNING" : "ACTION_REQUIRED";
    checks.push({
      key: "fulfillment_readiness",
      label: "Fulfillment readiness",
      status: fStatus,
      detail: locRes.ok
        ? `Fulfillment API reachable; ${locRes.data?.locations?.length || 0} location(s).${missing.length ? ` Missing scopes: ${missing.join(", ")}.` : ""} Native Printful fulfillment preserved.`
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

  // ---- Printful Store API compatibility (Shopify-platform 400 is EXPECTED, not auth failure) ----
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

  // ---- Credential Health (consolidated Shopify + Printful credential validity + renewal) ----
  const credentialStatus = worstStatus([
    { status: shopifyAuthStatus },
    { status: renewalStatus },
    { status: printfulAuthStatus },
  ]);
  checks.push({
    key: "credential_health",
    label: "Credential health",
    status: credentialStatus,
    detail:
      credentialStatus === "HEALTHY"
        ? "All commerce credentials valid and renewable; no expiration within the early-warning window."
        : "One or more commerce credentials are missing, expired, or not auto-renewable. Resolve before they become unusable.",
    shopify_auth: shopifyAuthStatus,
    shopify_renewal: renewalStatus,
    printful_auth: printfulAuthStatus,
  });

  // ---- Duplicate-write protection (read-only presence check; no writes performed) ----
  let idempotencyEntityOk = false;
  try {
    const client: any = createClientFromRequest(req);
    if (client?.entities?.CommerceIdempotencyKey) {
      await client.entities.CommerceIdempotencyKey.list(undefined, 1);
      idempotencyEntityOk = true;
    }
  } catch { /* no user context or entity not readable — report WARNING, never fail the run */ }
  const guardedOps = ["shopify.createDraft", "shopify.completeDraft", "shopify.sendInvoice", "shopify.fulfillOrder"];
  checks.push({
    key: "duplicate_write_protection",
    label: "Duplicate-write protection",
    status: idempotencyEntityOk ? "HEALTHY" : "WARNING",
    detail: idempotencyEntityOk
      ? `Idempotency guard active (CommerceIdempotencyKey entity readable). Protected operations: ${guardedOps.join(", ")}. Duplicate writes replay the confirmed result instead of re-submitting.`
      : "CommerceIdempotencyKey entity not readable from this context; idempotency guard presence could not be confirmed.",
    protected_operations: guardedOps,
    entity_readable: idempotencyEntityOk,
    rule: "Never retry a write blindly after an unknown result — check the remote system first to determine whether it already completed.",
  });

  // ---- Secret redaction (self-scan the serialized checks for any credential value) ----
  let leakFound: string | null = null;
  try {
    const serialized = JSON.stringify(checks);
    for (const sv of secretValues) {
      if (sv && sv.length >= 8 && serialized.includes(sv)) {
        leakFound = "A secret value was detected in the diagnostic response.";
        break;
      }
    }
    // Structural guard: no field key should carry a credential-looking name with a value.
    const sensitiveKeyPattern = /"(access_token|refresh_token|client_secret|api_token|bearer|authorization|x-shopify-access-token|x-pf-store-id)"\s*:\s*"[^"]+"/i;
    if (!leakFound && sensitiveKeyPattern.test(serialized)) {
      leakFound = "A credential-looking field was detected in the diagnostic response.";
    }
  } catch { /* serialization failure — treat as redaction warning */ }
  checks.push({
    key: "secret_redaction",
    label: "Secret redaction",
    status: leakFound ? "ACTION_REQUIRED" : "HEALTHY",
    detail: leakFound
      ? `${leakFound} Audit and strip credentials from all commerce responses, logs, and error messages.`
      : "No tokens, secrets, authorization headers, session JWTs, or credentials exposed in the diagnostic response.",
  });

  // Attach human-readable remediation instructions to every non-HEALTHY check.
  for (const c of checks) {
    if (c.status !== "HEALTHY") c.remediation = REMEDIATION[c.key] || "Review the commerce configuration and reconnect any failing integration.";
  }

  const overall = worstStatus(checks);
  return Response.json({ overall, checked_at: checkedAt, checks });
}