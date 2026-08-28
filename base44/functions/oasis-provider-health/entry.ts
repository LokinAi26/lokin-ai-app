import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from "npm:@base44/sdk";

const clean = (value:any, max=2000) => String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

async function upsert(base44:any, providerKey:string, payload:any) {
  const rows = await base44.asServiceRole.entities.OasisProviderCapability.filter(
    { provider_key: providerKey },
    "-updated_at",
    1,
    0,
  );
  if (rows?.[0]) return base44.asServiceRole.entities.OasisProviderCapability.update(rows[0].id, payload);
  return base44.asServiceRole.entities.OasisProviderCapability.create({ provider_key: providerKey, ...payload });
}

async function checkRecraft() {
  const token = clean(Deno.env.get("RECRAFT_API_TOKEN") || Deno.env.get("RECRAFT_API_KEY"), 2000);
  if (!token) {
    return { setup_status: "setup_required", health_status: "unknown", reason: "RECRAFT_API_TOKEN is not configured", credits: null, latency_ms: 0 };
  }
  const started = Date.now();
  try {
    const response = await fetch("https://external.api.recraft.ai/v1/users/me", {
      headers: { authorization: `Bearer ${token}` },
      redirect: "manual",
    });
    const latency = Date.now() - started;
    if (!response.ok) {
      return { setup_status: response.status === 401 || response.status === 403 ? "setup_required" : "degraded", health_status: "degraded", reason: `Recraft health returned HTTP ${response.status}`, credits: null, latency_ms: latency };
    }
    const data = await response.json().catch(() => ({}));
    return { setup_status: "configured", health_status: "healthy", reason: null, credits: Number.isFinite(Number(data?.credits)) ? Number(data.credits) : null, latency_ms: latency };
  } catch (error:any) {
    return { setup_status: "degraded", health_status: "offline", reason: clean(error?.message || error, 500), credits: null, latency_ms: Date.now() - started };
  }
}

async function checkProductions() {
  const url = clean(Deno.env.get("LOKIN_PRODUCTIONS_BRIDGE_URL"), 2000).replace(/\/$/, "");
  const token = clean(Deno.env.get("LOKIN_PRODUCTIONS_BRIDGE_TOKEN"), 2000);
  if (!url || !token) {
    return { setup_status: "setup_required", health_status: "unknown", reason: "LOKIN_PRODUCTIONS_BRIDGE_URL and LOKIN_PRODUCTIONS_BRIDGE_TOKEN are required", latency_ms: 0, detail: null };
  }
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      redirect: "manual",
    });
    const latency = Date.now() - started;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { setup_status: response.status === 401 || response.status === 403 ? "setup_required" : "degraded", health_status: "degraded", reason: clean(data?.error || `Render pool health returned HTTP ${response.status}`, 500), latency_ms: latency, detail: null };
    }
    const healthy = data?.planning_ready === true && data?.status === "healthy";
    return {
      setup_status: "configured",
      health_status: healthy ? "healthy" : "degraded",
      reason: healthy ? null : "Render pool is reachable but has no healthy live provider capacity",
      latency_ms: latency,
      detail: {
        contract_version: clean(data?.contract_version, 120),
        healthy_provider_count: Number(data?.healthy_provider_count || 0),
        total_live_capacity: Number(data?.total_live_capacity || 0),
        execution_requires_separate_approval: data?.execution_requires_separate_approval !== false,
      },
    };
  } catch (error:any) {
    return { setup_status: "degraded", health_status: "offline", reason: clean(error?.message || error, 500), latency_ms: Date.now() - started, detail: null };
  }
}

export default async function(req:Request) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'oasis_provider_health', priority:35, estimatedMs:5000, realtime:false, background:true, tags:['provider','scheduled'] });
    const now = new Date().toISOString();
    const organizationId = user.organization_id || user.id;

    const [recraft, productions] = await Promise.all([checkRecraft(), checkProductions()]);

    const [recraftRow, productionsRow] = await Promise.all([
      upsert(base44, "recraft", {
        organization_id: organizationId,
        display_name: "Recraft Vector API",
        capability: "vector",
        execution_mode: "external_api",
        setup_status: recraft.setup_status,
        health_status: recraft.health_status,
        supports_async: true,
        max_concurrency: recraft.health_status === "healthy" ? 1 : 0,
        estimated_unit_cost_usd: 0,
        configuration_json: JSON.stringify({
          credentials_stored: false,
          secret_reference: "RECRAFT_API_TOKEN",
          model: "recraftv4_vector",
          credits_balance: recraft.credits,
          latency_ms: recraft.latency_ms,
          reason: recraft.reason,
          probe: "GET /v1/users/me; no generation",
        }),
        last_checked_at: now,
        updated_at: now,
      }),
      upsert(base44, "lokin_productions", {
        organization_id: organizationId,
        display_name: "LOKIN Productions Render Pool",
        capability: "video",
        execution_mode: "cloud_worker",
        setup_status: productions.setup_status,
        health_status: productions.health_status,
        supports_async: true,
        max_concurrency: Number(productions.detail?.total_live_capacity || 0),
        estimated_unit_cost_usd: 0,
        configuration_json: JSON.stringify({
          credentials_stored: false,
          secret_references: ["LOKIN_PRODUCTIONS_BRIDGE_URL", "LOKIN_PRODUCTIONS_BRIDGE_TOKEN"],
          contract_version: productions.detail?.contract_version || "OASIS_RENDER_POOL_V1",
          healthy_provider_count: Number(productions.detail?.healthy_provider_count || 0),
          total_live_capacity: Number(productions.detail?.total_live_capacity || 0),
          latency_ms: productions.latency_ms,
          reason: productions.reason,
          execution_requires_separate_approval: true,
        }),
        last_checked_at: now,
        updated_at: now,
      }),
    ]);

    return Response.json({
      checked_at: now,
      zero_spend_probe: true,
      providers: [
        { key: "recraft", setup_status: recraftRow.setup_status, health_status: recraftRow.health_status, reason: recraft.reason, credits_balance: recraft.credits },
        { key: "lokin_productions", setup_status: productionsRow.setup_status, health_status: productionsRow.health_status, reason: productions.reason, capacity: productions.detail?.total_live_capacity || 0 },
      ],
      disclosure: "Health checks only. No image, vector, video, audio, or other paid generation was requested.",
    });
  } catch (error:any) {
    console.error("oasis-provider-health", error);
    return Response.json({ error: clean(error?.message || error, 1000) || "OASIS provider health unavailable" }, { status: 500 });
  }
}
