import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { secrets } from "base44:runtime";
import {
  exchangeUberAuthorizationCode,
  storeUberAuthorization,
  UBER_API_BASE,
  UBER_DRIVER_SCOPES,
  UBER_PROVIDER_KEY,
  uberOAuthConfigured,
  uberOAuthMissingSecrets,
  verifyUberState,
} from "../../shared/uberDriverOAuth.ts";

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

async function uberGet(path: string, token: string) {
  const response = await fetch(`${UBER_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || `Uber API request failed (${response.status})`);
  return data;
}

export default async function uberDriverOauthCallback(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    if (!uberOAuthConfigured(secrets)) {
      return Response.json({ error: "Uber OAuth is not configured", missing_secrets: uberOAuthMissingSecrets(secrets) }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.error) {
      return Response.json({ error: clean(body.error_description || body.error, 500), code: "UBER_AUTHORIZATION_REJECTED" }, { status: 400 });
    }
    const code = clean(body?.code, 2000);
    const state = clean(body?.state, 2000);
    if (!code || !state) return Response.json({ error: "Missing Uber authorization code or state", code: "INVALID_CALLBACK" }, { status: 400 });

    const clientSecret = String(secrets.get("UBER_DRIVER_CLIENT_SECRET") || "");
    if (!await verifyUberState(state, String(user.id), clientSecret)) {
      return Response.json({ error: "Invalid or expired Uber OAuth state. Start the connection again.", code: "INVALID_OAUTH_STATE" }, { status: 400 });
    }

    const tokenData = await exchangeUberAuthorizationCode(code, secrets);
    const accessToken = clean(tokenData?.access_token, 10000);
    if (!accessToken) return Response.json({ error: "Uber did not return an access token", code: "TOKEN_EXCHANGE_INVALID" }, { status: 502 });

    await storeUberAuthorization(base44, String(user.id), tokenData, secrets);

    let profile: any = null;
    let apiError = "";
    try {
      profile = await uberGet("/partners/me", accessToken);
    } catch (error) {
      apiError = error instanceof Error ? error.message : "Uber Driver profile access is not yet available";
    }

    const rows = await base44.entities.DriverPlatformConnection.filter({ user_id: String(user.id), platform_name: UBER_PROVIDER_KEY });
    const existing = rows?.[0] || null;
    const approvalState = existing?.approval_state || "required";
    const apiVerified = Boolean(profile?.driver_id);
    const status = apiVerified && approvalState === "approved" ? "connected" : "pending";
    const values = {
      user_id: String(user.id),
      platform_name: UBER_PROVIDER_KEY,
      connection_type: "official_oauth",
      access_mode: "oauth_limited_access",
      status,
      approval_state: approvalState,
      authorization_state: "authorized",
      capabilities: ["profile", "trips", "payments"],
      can_sync_profile: apiVerified,
      can_sync_trips: apiVerified,
      can_sync_payments: apiVerified,
      can_ingest_live_offers: false,
      can_ingest_partner_orders: false,
      data_disclosure: "Driver-authorized Uber profile, trip history, and payments only. Public production access remains subject to Uber Driver API approval. No live-offer acceptance or platform-control capability is enabled.",
      external_account_ref: clean(profile?.driver_id, 500),
      last_checked_at: new Date().toISOString(),
      last_error: apiError,
    };
    const connection = existing
      ? await base44.entities.DriverPlatformConnection.update(existing.id, values)
      : await base44.entities.DriverPlatformConnection.create(values);

    return Response.json({
      authorized: true,
      api_verified: apiVerified,
      provider: UBER_PROVIDER_KEY,
      status: connection.status,
      approval_state: connection.approval_state,
      granted_scopes: String(tokenData?.scope || UBER_DRIVER_SCOPES.join(" ")).split(/[ ,]+/).filter(Boolean),
      profile: profile ? {
        driver_id: clean(profile.driver_id, 500),
        rating: Number.isFinite(Number(profile.rating)) ? Number(profile.rating) : null,
        activation_status: clean(profile.activation_status, 80),
      } : null,
      api_error: apiError || null,
      tokens_exposed_to_client: false,
    });
  } catch (error) {
    console.error("uber-driver-oauth-callback error", error);
    return Response.json({ error: error instanceof Error ? error.message : "Uber authorization failed", code: "UBER_OAUTH_CALLBACK_FAILED" }, { status: 500 });
  }
}
