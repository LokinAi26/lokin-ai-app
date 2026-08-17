// Shared Printful OAuth 2.0 helpers.
// Used by printful-catalog, printful-tools, printful-oauth-connect, printful-oauth-callback.
//
// Printful OAuth flow (https://developers.printful.com/docs/#tag/Public-App-authorization):
//   authorize: https://www.printful.com/oauth/authorize?client_id=..&state=..&redirect_url=..
//   token:      POST https://www.printful.com/oauth/token  (form-urlencoded, grant_type=authorization_code|refresh_token)
//   access_token expires in 1h; refresh_token expires in 90 days.

const TOKEN_URL = "https://www.printful.com/oauth/token";

async function hmacSign(msg: string, keyMaterial: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// Stateless, signed OAuth state token: userId.expiresAt.nonce.signature
export async function makeState(userId: string, clientSecret = "lokin-printful-fallback"): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 600;
  const nonce = crypto.randomUUID();
  const sig = await hmacSign(`${userId}.${exp}.${nonce}`, clientSecret);
  return `${userId}.${exp}.${nonce}.${sig}`;
}

export async function verifyState(state: string, userId: string, clientSecret = "lokin-printful-fallback"): Promise<boolean> {
  if (!state || typeof state !== "string") return false;
  const parts = state.split(".");
  if (parts.length !== 4) return false;
  const [uid, exp, nonce, sig] = parts;
  if (uid !== String(userId)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacSign(`${uid}.${exp}.${nonce}`, clientSecret);
  return expected === sig;
}

export function oauthConfigured(secrets: any): boolean {
  return !!(secrets.get("PRINTFUL_OAUTH_CLIENT_ID") && secrets.get("PRINTFUL_OAUTH_CLIENT_SECRET") && secrets.get("PRINTFUL_OAUTH_REDIRECT_URI"));
}

// Read the current user's Printful connection (service role bypasses RLS so admin + MCP contexts work).
export async function getPrintfulConnection(base44: any, userId: string): Promise<any> {
  const list = await base44.asServiceRole.entities.PrintfulConnection.filter({ user_id: String(userId) });
  return list && list[0] ? list[0] : null;
}

async function refreshPrintfulToken(base44: any, conn: any, secrets: any): Promise<any | null> {
  const clientSecret = secrets.get("PRINTFUL_OAUTH_CLIENT_SECRET");
  if (!clientSecret || !conn.refresh_token) return null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_secret: clientSecret,
    refresh_token: conn.refresh_token,
  });
  try {
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("printful token refresh failed:", r.status, txt);
      return null;
    }
    const data = await r.json();
    const updated = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Number(data.expires_at) || 0,
      status: "connected",
      last_error: "",
    };
    await base44.asServiceRole.entities.PrintfulConnection.update(conn.id, updated);
    return { ...conn, ...updated };
  } catch (e) {
    console.error("printful token refresh error:", e);
    return null;
  }
}

// Resolve the effective Printful bearer token for a user:
//   - OAuth access_token (auto-refreshed within 5 min of expiry) if a connection exists
//   - else the shared personal PRINTFUL_API_TOKEN
// Returns { token, storeId, source, storeName }.
function normalizePrintfulToken(value: any): string {
  return String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^['\"]|['\"]$/g, "")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .trim();
}

export async function getEffectiveToken(base44: any, user: { id: string }, secrets: any): Promise<{ token: string; storeId: string; source: string; storeName: string }> {
  const conn = await getPrintfulConnection(base44, user.id);
  if (conn && conn.access_token && conn.status !== "disconnected") {
    const now = Math.floor(Date.now() / 1000);
    if (conn.expires_at && conn.expires_at - now < 300) {
      const refreshed = await refreshPrintfulToken(base44, conn, secrets);
      if (refreshed) {
        return { token: normalizePrintfulToken(refreshed.access_token), storeId: refreshed.store_id || "", source: "oauth", storeName: refreshed.store_name || "" };
      }
      // refresh failed -> fall through to personal token
    } else {
      return { token: normalizePrintfulToken(conn.access_token), storeId: conn.store_id || "", source: "oauth", storeName: conn.store_name || "" };
    }
  }
  return { token: normalizePrintfulToken(secrets.get("PRINTFUL_API_TOKEN")), storeId: "", source: "personal", storeName: "" };
}