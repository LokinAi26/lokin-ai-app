import { secrets } from "base44:runtime";

let cachedToken = "";
let cachedTokenExpiresAt = 0;
let cachedTokenDomain = "";

export function normalizeShopifyDomain(raw: unknown): string {
  const normalized = String(raw || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^admin\.shopify\.com\/store\//i, "")
    .split("/")[0]
    .replace(/\/+$/, "");
  return normalized && !normalized.includes(".") ? `${normalized}.myshopify.com` : normalized;
}

function cleanSecret(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^['\"]|['\"]$/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

export type ShopifyTokenResult = {
  token: string;
  source: "client_credentials" | "static" | "none";
  domain: string;
  expiresAt?: number;
  scope?: string;
  error?: string;
  status?: number;
};

/**
 * Resolve a Shopify Admin API token.
 *
 * Preferred path: Shopify Dev Dashboard client credentials grant.
 * Tokens are valid for ~24h; cache them in-process and refresh 5 minutes early.
 * Static SHOPIFY_ACCESS_TOKEN remains as a compatibility fallback during migration.
 */
export async function getShopifyAdminToken(): Promise<ShopifyTokenResult> {
  const domain = normalizeShopifyDomain(secrets.get("SHOPIFY_STORE_DOMAIN"));
  if (!domain) return { token: "", source: "none", domain: "", error: "SHOPIFY_STORE_DOMAIN is missing." };

  const clientId = cleanSecret(secrets.get("SHOPIFY_CLIENT_ID"));
  const clientSecret = cleanSecret(secrets.get("SHOPIFY_CLIENT_SECRET"));

  if (clientId && clientSecret) {
    const now = Date.now();
    if (cachedToken && cachedTokenDomain === domain && now < cachedTokenExpiresAt - 5 * 60_000) {
      return { token: cachedToken, source: "client_credentials", domain, expiresAt: cachedTokenExpiresAt };
    }

    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });
      const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body,
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }

      if (res.ok && data?.access_token) {
        const expiresIn = Math.max(60, Number(data.expires_in) || 86399);
        cachedToken = cleanSecret(data.access_token);
        cachedTokenDomain = domain;
        cachedTokenExpiresAt = Date.now() + expiresIn * 1000;
        return {
          token: cachedToken,
          source: "client_credentials",
          domain,
          expiresAt: cachedTokenExpiresAt,
          scope: String(data.scope || ""),
        };
      }

      // Keep migration safe: if the new app has not been released/installed yet,
      // allow the old static token to continue working until setup is complete.
      const fallback = cleanSecret(secrets.get("SHOPIFY_ACCESS_TOKEN"));
      if (fallback) {
        return {
          token: fallback,
          source: "static",
          domain,
          status: res.status,
          error: data?.error_description || data?.error || data?.errors || `Client-credentials exchange failed (HTTP ${res.status}).`,
        };
      }
      return {
        token: "",
        source: "none",
        domain,
        status: res.status,
        error: data?.error_description || data?.error || data?.errors || `Client-credentials exchange failed (HTTP ${res.status}).`,
      };
    } catch (error) {
      const fallback = cleanSecret(secrets.get("SHOPIFY_ACCESS_TOKEN"));
      if (fallback) return { token: fallback, source: "static", domain, error: error?.message || "Shopify token exchange failed." };
      return { token: "", source: "none", domain, error: error?.message || "Shopify token exchange failed." };
    }
  }

  const fallback = cleanSecret(secrets.get("SHOPIFY_ACCESS_TOKEN"));
  if (fallback) return { token: fallback, source: "static", domain };
  return { token: "", source: "none", domain, error: "SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET are missing and no static SHOPIFY_ACCESS_TOKEN is available." };
}
