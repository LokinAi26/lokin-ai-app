// Shopify HMAC-SHA256 verification for embedded-app URLs and OAuth callbacks.
// Shopify signs the query params (excluding hmac/signature) with the API secret.
// Web Crypto SubtleCrypto — no external deps.

export async function verifyShopifyHmac(
  params: Record<string, string>,
  apiSecret: string
): Promise<boolean> {
  try {
    const hmac = String(params.hmac || params.signature || "").trim();
    if (!hmac) return false;

    const { hmac: _h, signature: _s, ...rest } = params;
    const message = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k] ?? ""}`)
      .join("&");

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    const digest = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return digest.toLowerCase() === hmac.toLowerCase();
  } catch {
    return false;
  }
}