import { secrets } from "base44:runtime";
import { getShopifyAdminToken } from "../../shared/shopifyAuth.ts";
import { verifyShopifyHmac } from "../../shared/shopifyHmac.ts";
import { verifyShopifySession } from "../../shared/shopifyJwt.ts";
import { shopifyAdminBase, shoGet, mapStorefront, mapOrders } from "../../shared/shopifyReads.ts";

/**
 * shopify-embed — Public, iframe-safe Shopify storefront for the LOKIN Commerce
 * embedded app running inside the Shopify Admin.
 *
 * Unlike shopify-catalog (which requires an authenticated Base44 user), this
 * function runs with NO Base44 user so it can render inside the Shopify iframe
 * where Base44 auth cannot run. It uses the server-side Shopify credentials
 * (SHOPIFY_STORE_DOMAIN + SHOPIFY_ACCESS_TOKEN / client-credentials) and
 * authenticates Shopify-originated requests via HMAC verification.
 *
 *   storefront / health  -> open (store catalog is semi-public)
 *   orders / order       -> require a valid Shopify HMAC (sensitive data)
 *
 * Actions (payload.action):
 *   health      shopify connection status + HMAC authenticity flag
 *   storefront  shop info + enriched product catalog (one round-trip)
 *   orders      recent orders (HMAC-gated)
 *   order       single order by id (HMAC-gated)
 *
 * Frontend passes the raw Shopify URL params in payload.params so HMAC can be
 * verified server-side with SHOPIFY_CLIENT_SECRET.
 */
const VALID_ACTIONS = ["health", "storefront", "orders", "order"];

export default async function (req: Request): Promise<Response> {
  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "storefront").toLowerCase();
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json(
        { error: `Invalid action. Use one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const auth = await getShopifyAdminToken();
    if (!auth.token) {
      return Response.json(
        {
          shopify: { connected: false, domain: auth.domain, error: auth.error },
          error: auth.error || "Shopify not configured",
        },
        { status: 502 }
      );
    }

    // Shopify-origin authenticity (HMAC over embed/callback URL params).
    const params = payload.params && typeof payload.params === "object" ? payload.params : {};
    let hmacValid = false;
    const apiSecret = String(secrets.get("SHOPIFY_CLIENT_SECRET") || "").trim();
    const clientId = String(secrets.get("SHOPIFY_CLIENT_ID") || "").trim();
    if (params.hmac || params.signature) {
      if (apiSecret) hmacValid = await verifyShopifyHmac(params, apiSecret);
    }
    // Verify the Shopify session JWT (id_token) — proves the specific merchant
    // + admin user session with expiry. Stronger than HMAC for sensitive reads.
    const session = params.id_token
      ? await verifyShopifySession(String(params.id_token), apiSecret, clientId)
      : { valid: false };
    const authenticated = hmacValid === true || session.valid === true;

    const base = shopifyAdminBase(auth.domain);
    const token = auth.token;

    // ----- health -----
    if (action === "health") {
      return Response.json({
        shopify: {
          connected: true,
          domain: auth.domain,
          token_source: auth.source,
          scope: auth.scope || null,
        },
        client_id: clientId || null,
        hmac_valid: hmacValid,
        session,
        embedded: Boolean(params.embedded || params.host),
      });
    }

    // ----- storefront (shop + catalog, one round-trip) -----
    if (action === "storefront") {
      const cap = Math.min(250, Math.max(1, Number(payload.limit) || 250));
      const [shopR, productsR] = await Promise.all([
        shoGet(`${base}/shop.json`, token),
        shoGet(`${base}/products.json?limit=${cap}`, token),
      ]);
      const authError =
        shopR.status === 401 || productsR.status === 401
          ? "Your Shopify access token is invalid or expired. Update SHOPIFY_CLIENT_SECRET and SHOPIFY_ACCESS_TOKEN in Base44 Secrets, or reinstall LOKIN Commerce from your Shopify Admin."
          : shopR.status === 404 || productsR.status === 404
          ? "Shopify store domain not found. Verify SHOPIFY_STORE_DOMAIN in Base44 Secrets."
          : null;
      if (authError) return Response.json({ error: authError, shopify_status: shopR.status || productsR.status }, { status: 401 });
      if (!shopR.ok) return Response.json({ error: shopR.error }, { status: shopR.status });
      if (!productsR.ok) return Response.json({ error: productsR.error }, { status: productsR.status });
      return Response.json({
        ...mapStorefront(shopR.data?.shop || {}, productsR.data),
        hmac_valid: hmacValid,
        session,
      });
    }

    // ----- orders (HMAC-gated) -----
    if (action === "orders") {
      if (!authenticated) {
        return Response.json(
          { error: "Authenticated Shopify session required for orders. Open LOKIN Commerce from your Shopify Admin." },
          { status: 403 }
        );
      }
      const limit = Math.min(250, Math.max(1, Number(payload.limit) || 50));
      const status = payload.status ? `&status=${encodeURIComponent(payload.status)}` : "";
      const r = await shoGet(`${base}/orders.json?limit=${limit}${status}`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ orders: mapOrders(r.data) });
    }

    // ----- single order (HMAC-gated) -----
    if (action === "order") {
      if (!authenticated) {
        return Response.json({ error: "Authenticated Shopify session required for order details." }, { status: 403 });
      }
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const r = await shoGet(`${base}/orders/${encodeURIComponent(id)}.json`, token);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ order: r.data?.order });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("shopify-embed error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}