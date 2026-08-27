import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { secrets } from "base44:runtime";
import {
  buildUberAuthorizeUrl,
  makeUberState,
  UBER_DRIVER_SCOPES,
  UBER_PROVIDER_KEY,
  uberOAuthConfigured,
  uberOAuthMissingSecrets,
} from "../../shared/uberDriverOAuth.ts";

async function upsertConnection(base44: any, userId: string) {
  const rows = await base44.entities.DriverPlatformConnection.filter({ user_id: userId, platform_name: UBER_PROVIDER_KEY });
  const existing = rows?.[0] || null;
  const values = {
    user_id: userId,
    platform_name: UBER_PROVIDER_KEY,
    connection_type: "official_oauth",
    access_mode: "oauth_limited_access",
    status: "pending_authorization",
    approval_state: existing?.approval_state || "required",
    authorization_state: "pending",
    capabilities: ["profile", "trips", "payments"],
    can_sync_profile: false,
    can_sync_trips: false,
    can_sync_payments: false,
    can_ingest_live_offers: false,
    can_ingest_partner_orders: false,
    data_disclosure: "Uber Driver OAuth requests only partner.accounts, partner.trips, and partner.payments. Driver API access remains limited and provider approval is required for public production use. No live-offer acceptance capability is requested.",
    last_checked_at: new Date().toISOString(),
    last_error: "",
  };
  return existing
    ? await base44.entities.DriverPlatformConnection.update(existing.id, values)
    : await base44.entities.DriverPlatformConnection.create(values);
}

export default async function uberDriverOauthConnect(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

    if (!uberOAuthConfigured(secrets)) {
      return Response.json({
        configured: false,
        error: "Uber Driver OAuth is not fully configured in Base44 secrets.",
        missing_secrets: uberOAuthMissingSecrets(secrets),
        required_scopes: UBER_DRIVER_SCOPES,
        limited_access: true,
      }, { status: 503 });
    }

    await upsertConnection(base44, String(user.id));
    const clientSecret = String(secrets.get("UBER_DRIVER_CLIENT_SECRET") || "");
    const state = await makeUberState(String(user.id), clientSecret);
    const authorizeUrl = buildUberAuthorizeUrl(secrets, state);

    return Response.json({
      configured: true,
      provider: UBER_PROVIDER_KEY,
      authorize_url: authorizeUrl,
      required_scopes: UBER_DRIVER_SCOPES,
      approval_required_for_public_use: true,
      driver_confirmation_required: true,
      automatic_platform_action: false,
    });
  } catch (error) {
    console.error("uber-driver-oauth-connect error", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not start Uber authorization", code: "UBER_OAUTH_START_FAILED" }, { status: 500 });
  }
}
