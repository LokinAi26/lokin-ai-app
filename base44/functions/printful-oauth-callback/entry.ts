import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { verifyState, getPrintfulConnection, oauthConfigured } from "../../shared/printfulOAuth.ts";

/**
 * printful-oauth-callback — exchanges the Printful authorization code (returned to
 * the /printful/callback page) for OAuth access/refresh tokens, resolves the store,
 * and upserts the user's PrintfulConnection record.
 *
 * Frontend (PrintfulCallback.jsx) reads ?code & ?state from the URL and invokes this
 * function with { code, state, success }.
 *
 * Secrets: PRINTFUL_OAUTH_CLIENT_ID, PRINTFUL_OAUTH_CLIENT_SECRET, PRINTFUL_OAUTH_REDIRECT_URI
 */
const TOKEN_URL = "https://www.printful.com/oauth/token";
const API = "https://api.printful.com";

async function pfGet(path: string, token: string, storeId: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (storeId) headers["X-PF-Store-Id"] = String(storeId);
  const r = await fetch(`${API}${path}`, { headers });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'printful_oauth_exchange', priority:60, estimatedMs:5000, realtime:false, background:false, tags:['provider'] });

    const payload = await req.json().catch(() => ({}));
    const code = String(payload.code || "");
    const state = String(payload.state || "");
    const success = payload.success !== 0 && payload.success !== "0" && payload.success !== "false";

    if (!success) return Response.json({ error: "Printful authorization was rejected." }, { status: 400 });
    if (!code) return Response.json({ error: "Missing authorization code." }, { status: 400 });

    // Fail closed BEFORE state verification: never sign/verify with a fallback secret.
    if (!oauthConfigured(secrets)) {
      return Response.json({ error: "Printful OAuth is not fully configured." }, { status: 503 });
    }

    const okState = await verifyState(state, user.id, secrets.get("PRINTFUL_OAUTH_CLIENT_SECRET"));
    if (!okState) return Response.json({ error: "Invalid or expired OAuth state. Please reconnect." }, { status: 400 });

    const clientId = secrets.get("PRINTFUL_OAUTH_CLIENT_ID");
    const clientSecret = secrets.get("PRINTFUL_OAUTH_CLIENT_SECRET");
    const redirectUri = secrets.get("PRINTFUL_OAUTH_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      return Response.json({ error: "Printful OAuth is not fully configured." }, { status: 503 });
    }

    // Exchange the authorization code for tokens (OAuth 2.0 form-urlencoded).
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_url: redirectUri,
    });
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      console.error("printful token exchange failed:", tokenRes.status, JSON.stringify(tokenData));
      return Response.json({ error: tokenData?.error?.message || tokenData?.result || "Token exchange failed." }, { status: 400 });
    }
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = Number(tokenData.expires_at) || 0;
    if (!accessToken || !refreshToken) {
      return Response.json({ error: "Printful did not return access/refresh tokens." }, { status: 502 });
    }

    // Resolve the store on this token (first store).
    const storeRes = await pfGet(`/stores`, accessToken, "");
    let storeId = "";
    let storeName = "";
    let storeType = "";
    if (storeRes.ok && Array.isArray(storeRes.data?.result) && storeRes.data.result[0]) {
      const s = storeRes.data.result[0];
      storeId = String(s.id);
      storeName = s.name || "";
      storeType = s.type || "";
    }

    // Upsert the user's PrintfulConnection.
    const existing = await getPrintfulConnection(base44, user.id);
    const record = {
      user_id: String(user.id),
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      store_id: storeId,
      store_name: storeName,
      store_type: storeType,
      scopes: tokenData.scope || "",
      status: "connected",
      last_error: "",
      connected_at: new Date().toISOString(),
    };
    if (existing) {
      await base44.asServiceRole.entities.PrintfulConnection.update(existing.id, record);
    } else {
      await base44.asServiceRole.entities.PrintfulConnection.create(record);
    }

    return Response.json({ connected: true, store: { id: storeId, name: storeName, type: storeType } });
  } catch (error) {
    console.error("printful-oauth-callback error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}