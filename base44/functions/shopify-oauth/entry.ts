import { secrets } from "base44:runtime";
import { normalizeShopifyDomain } from "../../shared/shopifyAuth.ts";
import { verifyShopifyHmac } from "../../shared/shopifyHmac.ts";

/**
 * shopify-oauth — Handles the Shopify install/reinstall OAuth callback for the
 * LOKIN Commerce embedded app.
 *
 * Shopify redirects to the app URL with ?code=...&hmac=...&shop=...&state=...&timestamp=...
 * The frontend (ShopifyEmbed.jsx) reads those params and invokes this function.
 * This function:
 *   1. Verifies the HMAC with SHOPIFY_CLIENT_SECRET (authenticity).
 *   2. Exchanges the code for a store access token (POST /admin/oauth/access_token).
 *   3. Returns the embedded-app redirect URL so Shopify re-embeds the app.
 *
 * The store access token for the configured store is already held in the
 * SHOPIFY_ACCESS_TOKEN secret, so we do not persist it here. This handler exists
 * to complete the OAuth handshake and verify redirect handling.
 */
function clean(v: unknown): string {
  return String(v || "").trim();
}

export default async function (req: Request): Promise<Response> {
  try {
    const payload = await req.json().catch(() => ({}));
    const params = payload.params && typeof payload.params === "object" ? payload.params : {};
    const shop = normalizeShopifyDomain(params.shop);
    const code = clean(params.code);
    const clientId = clean(secrets.get("SHOPIFY_CLIENT_ID"));
    const clientSecret = clean(secrets.get("SHOPIFY_CLIENT_SECRET"));

    if (!shop) return Response.json({ error: "Missing shop parameter." }, { status: 400 });
    if (!code) return Response.json({ error: "Missing authorization code." }, { status: 400 });
    if (!clientId || !clientSecret) {
      return Response.json({ error: "SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET not configured." }, { status: 500 });
    }

    const hmacValid = await verifyShopifyHmac(params, clientSecret);
    if (!hmacValid) {
      return Response.json({ error: "Invalid HMAC — request is not authentic." }, { status: 403 });
    }

    // Exchange the authorization code for a store access token.
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code });
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!res.ok || !data?.access_token) {
      return Response.json(
        { error: data?.error_description || data?.error || `Token exchange failed (HTTP ${res.status}).` },
        { status: 502 }
      );
    }

    // Redirect back into the Shopify Admin so Shopify re-embeds the app.
    const redirectUrl = `https://${shop}/admin/apps/${clientId}`;
    return Response.json({ ok: true, shop, scope: data.scope || "", redirect_url: redirectUrl });
  } catch (error) {
    console.error("shopify-oauth error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}