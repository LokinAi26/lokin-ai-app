// Verify the Shopify embedded-app session JWT (id_token).
// Shopify signs the embedded `id_token` with HS256 using the app API secret
// (SHOPIFY_CLIENT_SECRET). Proving it server-side authenticates the specific
// merchant + admin user session (with expiry), which HMAC alone cannot —
// HMAC only proves the embed URL itself is untampered.
// Web Crypto SubtleCrypto — no external deps.

export type ShopifySession = {
  valid: boolean;
  shop?: string;
  userId?: string;
  exp?: number;
  error?: string;
};

function base64UrlDecode(input: string): Uint8Array {
  const s = String(input).replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const padded = s + "=".repeat(pad);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64UrlDecodeStr(input: string): string {
  return new TextDecoder().decode(base64UrlDecode(input));
}

export async function verifyShopifySession(
  idToken: string,
  apiSecret: string,
  expectedClientId: string
): Promise<ShopifySession> {
  try {
    if (!idToken || !apiSecret) return { valid: false, error: "Missing id_token or secret." };
    const parts = String(idToken).split(".");
    if (parts.length !== 3) return { valid: false, error: "Malformed id_token." };
    const [headerB64, payloadB64, sigB64] = parts;

    let header: any, payload: any;
    try {
      header = JSON.parse(base64UrlDecodeStr(headerB64));
      payload = JSON.parse(base64UrlDecodeStr(payloadB64));
    } catch {
      return { valid: false, error: "Unparseable id_token." };
    }

    if (String(header.alg || "").toUpperCase() !== "HS256") {
      return { valid: false, error: `Unexpected alg: ${header.alg}` };
    }

    // Verify the HS256 signature over "<header>.<payload>".
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signingInput = enc.encode(`${headerB64}.${payloadB64}`);
    const ok = await crypto.subtle.verify("HMAC", key, base64UrlDecode(sigB64), signingInput);
    if (!ok) return { valid: false, error: "Invalid id_token signature." };

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now >= Number(payload.exp)) return { valid: false, error: "id_token expired." };
    if (payload.nbf && now < Number(payload.nbf)) return { valid: false, error: "id_token not yet valid." };

    if (expectedClientId && String(payload.aud || "") !== String(expectedClientId)) {
      return { valid: false, error: "id_token audience mismatch." };
    }

    const shop = String(payload.dest || "").replace(/^https?:\/\//, "").replace(/\/+$/, "") || undefined;
    const userId = payload.sub ? String(payload.sub) : undefined;
    return { valid: true, shop, userId, exp: payload.exp };
  } catch (e) {
    return { valid: false, error: e?.message || "Session verification failed." };
  }
}