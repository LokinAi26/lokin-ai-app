import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  driverProviderList,
  normalizeDriverProviderKey,
  providerSafetyContract,
} from "../../shared/driverProviderRegistry.js";

function envSet(name: string) {
  return new Set(
    String(Deno.env.get(name) || "")
      .split(",")
      .map((value) => normalizeDriverProviderKey(value))
      .filter(Boolean),
  );
}

function capabilityNames(capabilities: Record<string, boolean>) {
  return Object.entries(capabilities).filter(([, enabled]) => enabled).map(([name]) => name);
}

export default async function driverPlatformStatus(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

    const rows = await base44.entities.DriverPlatformConnection.filter({ user_id: String(user.id) });
    const oauthReady = envSet("LOKIN_DRIVER_OAUTH_PROVIDERS");
    const offerIngestReady = envSet("LOKIN_DRIVER_PROVIDER_ALLOWLIST");

    const providers = driverProviderList().map((provider) => {
      const row = (rows || []).find((candidate: any) => normalizeDriverProviderKey(candidate.platform_name) === provider.key) || null;
      const adapterConfigured = oauthReady.has(provider.key) || offerIngestReady.has(provider.key);
      const authorized = row?.authorization_state === "authorized" && row?.approval_state === "approved";
      const active = authorized && adapterConfigured && row?.status === "connected";
      const potential = { ...provider.capabilities };
      const activeCapabilities = {
        profile: active && Boolean(row?.can_sync_profile),
        trips: active && Boolean(row?.can_sync_trips),
        payments: active && Boolean(row?.can_sync_payments),
        live_offers: active && Boolean(row?.can_ingest_live_offers) && offerIngestReady.has(provider.key),
        partner_orders: active && Boolean(row?.can_ingest_partner_orders) && offerIngestReady.has(provider.key),
      };

      return {
        key: provider.key,
        label: provider.label,
        access_mode: provider.access_mode,
        status: row?.status || provider.default_status,
        approval_state: row?.approval_state || (provider.approval_required ? "required" : "not_requested"),
        authorization_state: row?.authorization_state || "not_started",
        adapter_configured: adapterConfigured,
        oauth_adapter_configured: oauthReady.has(provider.key),
        signed_offer_ingest_configured: offerIngestReady.has(provider.key),
        potential_capabilities: potential,
        potential_capability_names: capabilityNames(potential),
        active_capabilities: activeCapabilities,
        active_capability_names: capabilityNames(activeCapabilities),
        last_sync_at: row?.last_sync_at || null,
        last_checked_at: row?.last_checked_at || null,
        last_error: row?.last_error || null,
        disclosure: row?.data_disclosure || provider.disclosure,
        driver_confirmation_required: true,
        automatic_platform_action: false,
      };
    });

    return Response.json({
      ok: true,
      generated_at: new Date().toISOString(),
      providers,
      safety: providerSafetyContract(),
      ingestion: {
        signed_gateway: "ingest-authorized-provider-offer",
        deny_by_default: true,
        activation_requirement: "Provider approval/contract, provider-specific adapter, server-side secret, and explicit provider allowlist.",
      },
      disclosure: "Connection status is factual. LOKIN does not label a provider connected until approval, authorization, adapter configuration, and a stored connected state are all present.",
    });
  } catch (error) {
    console.error("driver-platform-status error", error);
    return Response.json({ error: "Could not load driver platform status", code: "DRIVER_PLATFORM_STATUS_FAILED" }, { status: 500 });
  }
}
