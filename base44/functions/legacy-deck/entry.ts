import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { ecosystemEngineSummary } from "../../shared/ecosystemWorkloadFabric.js";

const ENGINE_IDS = ["pulse", "forge", "atlas", "sentinel", "governor"];
const ENGINE_REGISTRY = Object.fromEntries(ecosystemEngineSummary().map((engine:any) => [engine.id, engine]));
const ENGINE_ACTIVE_MS = 15 * 60 * 1000;
const ENGINE_RECENT_MS = 5 * 60 * 1000;
const VISION_LIVE_MS = 2 * 60 * 1000;
const ACTIVE_PRODUCTION = new Set(["awaiting_approval", "setup_required", "queued", "running", "qc", "blocked"]);
const ACTIVE_DISPATCH = new Set(["offered", "accepted", "en_route_pickup", "picked_up", "in_transit"]);
const HEALTHY = new Set(["ok", "healthy", "online", "pass", "passed", "ready", "active"]);

const now = () => new Date().toISOString();
const clean = (value:any, max=160) => String(value ?? "").trim().slice(0, max);
const num = (value:any) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ageMs = (value:any) => {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Number.POSITIVE_INFINITY;
};
const safe = async <T>(work:Promise<T>, fallback:T):Promise<T> => {
  try { return await work; } catch { return fallback; }
};

function latestBy<T extends Record<string, any>>(rows:T[], key:string, timeKey:string):Record<string, T> {
  const out:Record<string, T> = {};
  for (const row of rows || []) {
    const id = clean(row?.[key], 120);
    if (!id) continue;
    const current = out[id];
    if (!current || String(row?.[timeKey] || row?.updated_date || "") > String(current?.[timeKey] || current?.updated_date || "")) out[id] = row;
  }
  return out;
}

export default async function(req:Request) {
  try {
    if (req.method !== "POST") return Response.json({ error:"Method not allowed" }, { status:405 });
    const base44:any = createClientFromRequest(req);
    const user:any = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error:"Unauthorized" }, { status:401 });

    const body:any = await req.json().catch(() => ({}));
    const action = clean(body.action || "snapshot", 40).toLowerCase();

    if (action === "driver_pause" || action === "driver_resume") {
      const [profileRows, sessionRows]:any = await Promise.all([
        safe(base44.asServiceRole.entities.TruckDriverProfile.filter({ user_id:user.id }, "-updated_date", 1), []),
        safe(base44.asServiceRole.entities.DriverSession.filter({ user_id:user.id }, "-started_at", 1), []),
      ]);
      const profile = profileRows?.[0] || null;
      const session = sessionRows?.[0] || null;
      if (!profile && !session) return Response.json({ error:"No active driver profile or driver session exists yet. Open Dispatch/Driver once to configure it before using pause/resume." }, { status:409 });
      const pausing = action === "driver_pause";
      if (profile) await base44.asServiceRole.entities.TruckDriverProfile.update(profile.id, { status:pausing ? "paused" : "available", updated_at:now() });
      if (session && session.status !== "ended") {
        await base44.asServiceRole.entities.DriverSession.update(session.id, pausing
          ? { status:"paused", paused_at:now() }
          : { status:"working", resumed_at:now() });
      }
      return Response.json({ ok:true, status:pausing ? "paused" : "working", profile_id:profile?.id || null, session_id:session?.id || null, generated_at:now() });
    }

    if (action === "vision_heartbeat") {
      const deviceId = clean(body.device_id, 120);
      const deviceType = clean(body.device_type, 40);
      const validTypes = new Set(["simulator", "developer_glasses", "production_glasses", "phone_bridge"]);
      const validStatuses = new Set(["online", "idle", "navigating", "sleeping", "offline", "error"]);
      if (!deviceId || !validTypes.has(deviceType)) return Response.json({ error:"Valid device_id and device_type are required" }, { status:400 });
      const rows:any[] = await safe(base44.asServiceRole.entities.LokinVisionTelemetry.filter({ user_id:user.id, device_id:deviceId }, "-last_seen_at", 1), []);
      const payload:any = {
        user_id:user.id,
        device_id:deviceId,
        device_type:deviceType,
        platform:clean(body.platform, 80),
        status:validStatuses.has(clean(body.status, 40)) ? clean(body.status, 40) : "online",
        battery_percent:Math.max(0, Math.min(100, num(body.battery_percent))),
        temperature_c:num(body.temperature_c),
        wear_detected:body.wear_detected === true,
        navigation_state:clean(body.navigation_state, 120),
        firmware_version:clean(body.firmware_version, 80),
        last_seen_at:now(),
        metadata:body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      };
      const record = rows?.[0]
        ? await base44.asServiceRole.entities.LokinVisionTelemetry.update(rows[0].id, payload)
        : await base44.asServiceRole.entities.LokinVisionTelemetry.create(payload);
      return Response.json({ ok:true, device_id:record.id, last_seen_at:payload.last_seen_at });
    }

    if (action !== "snapshot") return Response.json({ error:"Unsupported action" }, { status:400 });

    const admin = user.role === "admin";
    const [earnings, assignments, profiles, sessions, platformConnections, jobs, pulses, workload, visionRows] = await Promise.all([
      safe(base44.asServiceRole.entities.Earning.filter({ created_by_id:user.id }, "-date", 31), []),
      safe(base44.asServiceRole.entities.DispatchAssignment.filter({ user_id:user.id }, "-assigned_at", 50), []),
      safe(base44.asServiceRole.entities.TruckDriverProfile.filter({ user_id:user.id }, "-updated_date", 1), []),
      safe(base44.asServiceRole.entities.DriverSession.filter({ user_id:user.id }, "-started_at", 5), []),
      safe(base44.asServiceRole.entities.DriverPlatformConnection.filter({ user_id:user.id }, "-last_checked_at", 25), []),
      safe(base44.asServiceRole.entities.OasisProductionJob.filter({ owner_user_id:user.id }, "-created_at", 80), []),
      admin ? safe(base44.asServiceRole.entities.LokinSystemPulse.filter({}, "-checked_at", 80), []) : Promise.resolve([]),
      safe(base44.asServiceRole.entities.EcosystemWorkloadDecision.filter({}, "-decided_at", 200), []),
      safe(base44.asServiceRole.entities.LokinVisionTelemetry.filter({ user_id:user.id }, "-last_seen_at", 10), []),
    ]);

    const latestEarningDate = earnings?.[0]?.date || null;
    const latestEarnings = (earnings || []).filter((r:any) => r.date === latestEarningDate);
    const earningTotal = latestEarnings.reduce((sum:number, r:any) => sum + num(r.amount), 0);
    const trips = latestEarnings.reduce((sum:number, r:any) => sum + num(r.trips), 0);
    const activeAssignments = (assignments || []).filter((r:any) => ACTIVE_DISPATCH.has(clean(r.status, 40)));
    const activeJobs = (jobs || []).filter((r:any) => ACTIVE_PRODUCTION.has(clean(r.status, 40)));
    const failedJobs = (jobs || []).filter((r:any) => ["failed", "blocked"].includes(clean(r.status, 40)));
    const qcJobs = (jobs || []).filter((r:any) => clean(r.status, 40) === "qc");

    const pulseMap = latestBy(pulses || [], "component", "checked_at");
    const componentHealth = Object.keys(pulseMap).map((component) => {
      const row:any = pulseMap[component];
      const raw = clean(row.status, 60).toLowerCase();
      return { component, status:raw || "unknown", latency_ms:num(row.latency_ms), checked_at:row.checked_at || row.updated_date || null };
    });
    const unhealthyComponents = componentHealth.filter((r:any) => !HEALTHY.has(r.status));

    const engineMap = latestBy(workload || [], "engine_id", "decided_at");
    const engines = ENGINE_IDS.map((id) => {
      const registry:any = ENGINE_REGISTRY[id] || { id, name:id.toUpperCase() };
      const row:any = engineMap[id] || null;
      const rawStatus = clean(row?.status, 40).toLowerCase();
      const decisionAge = ageMs(row?.completed_at || row?.decided_at);
      let liveStatus = rawStatus || "idle";
      if (["running", "admitted", "admitted_failover"].includes(rawStatus) && decisionAge > ENGINE_ACTIVE_MS) liveStatus = "idle";
      if (["completed", "duplicate", "deferred"].includes(rawStatus) && decisionAge > ENGINE_RECENT_MS) liveStatus = "idle";
      return {
        id,
        name: row?.engine_name || registry.name,
        mission:registry.mission || "",
        registered:true,
        status:liveStatus,
        last_status:rawStatus || null,
        operation:row?.operation || null,
        provider:row?.provider || null,
        accepted:row?.accepted === true,
        last_decision_at:row?.decided_at || null,
        last_completed_at:row?.completed_at || null,
        detail:row ? (liveStatus === "idle" ? `Registered · last workload ${rawStatus || "unknown"}` : `Live workload · ${row.operation || row.workload_type || rawStatus}`) : "Registered · ready for workload",
        error:row?.error || null,
      };
    });

    const alerts:any[] = [];
    for (const row of unhealthyComponents.slice(0, 5)) alerts.push({ severity:"warning", title:`${row.component} health`, detail:`Status: ${row.status}` });
    for (const job of failedJobs.slice(0, 5)) alerts.push({ severity:"critical", title:"Production job requires attention", detail:clean(job.error_message || job.error_code || job.status, 220), id:job.id });
    const engineFailures = engines.filter((e:any) => ["failed", "cancelled"].includes(e.status));
    for (const engine of engineFailures) alerts.push({ severity:"warning", title:`${engine.name} engine`, detail:engine.error || `Latest workload status: ${engine.status}` });

    const systemStatus = unhealthyComponents.length || failedJobs.length ? "DEGRADED" : "ONLINE";
    const driverProfile:any = profiles?.[0] || null;
    const latestSession:any = (sessions || []).find((row:any) => row.status !== "ended") || sessions?.[0] || null;
    const connectedPlatforms = (platformConnections || []).filter((row:any) => ["connected", "manual_only"].includes(clean(row.status, 40)));
    const driverStatus = driverProfile?.status || (latestSession?.status !== "ended" ? latestSession?.status : null) || (connectedPlatforms.length ? "connected" : "setup_required");
    const latestJob:any = jobs?.[0] || null;
    const productionStatus = activeJobs.length ? "active" : failedJobs.length ? "attention" : latestJob ? "idle" : "ready";
    const visionRecord:any = visionRows?.[0] || null;
    const visionAge = ageMs(visionRecord?.last_seen_at);
    const visionLive = Boolean(visionRecord && visionAge <= VISION_LIVE_MS && !["offline", "error"].includes(clean(visionRecord.status, 40)));
    const visionStatus = visionLive ? "connected" : visionRecord ? "stale" : "waiting_device";

    return Response.json({
      ok:true,
      deck_version:"1.0.0",
      generated_at:now(),
      user:{ name:user.full_name || user.name || user.email || "LOKIN Operator", email:user.email || "", role:user.role || "user" },
      system:{ status:systemStatus, components:componentHealth, alert_count:alerts.length },
      driver:{
        status:driverStatus,
        profile_configured:Boolean(driverProfile),
        session_status:latestSession?.status || null,
        connected_platforms:connectedPlatforms.length,
        active_assignments:activeAssignments.length,
        latest_assignment:activeAssignments?.[0] || assignments?.[0] || null,
        detail:driverProfile ? "Driver profile connected to live dispatch state." : latestSession ? "Live driver session detected; truck profile is not configured." : connectedPlatforms.length ? `${connectedPlatforms.length} driver platform connection(s) available.` : "Driver telemetry is wired; open Driver/Dispatch once to create the first live session/profile."
      },
      earnings:{ latest_date:latestEarningDate, amount:Number(earningTotal.toFixed(2)), trips },
      productions:{
        status:productionStatus,
        active:activeJobs.length,
        qc:qcJobs.length,
        failed:failedJobs.length,
        total_recent:(jobs || []).length,
        latest_status:latestJob?.status || null,
        latest_provider:latestJob?.provider_key || null,
        latest_capability:latestJob?.requested_capability || null,
        last_activity_at:latestJob?.updated_at || latestJob?.completed_at || latestJob?.started_at || latestJob?.created_at || null,
        latest:(jobs || []).slice(0, 5)
      },
      engines,
      vision:{
        status:visionStatus,
        telemetry:true,
        connected:visionLive,
        device_id:visionRecord?.device_id || null,
        device_type:visionRecord?.device_type || null,
        platform:visionRecord?.platform || null,
        battery_percent:visionRecord?.battery_percent ?? null,
        wear_detected:visionRecord?.wear_detected ?? null,
        navigation_state:visionRecord?.navigation_state || null,
        last_seen_at:visionRecord?.last_seen_at || null,
        detail:visionLive ? `${visionRecord.device_type} heartbeat live.` : visionRecord ? "Vision telemetry heartbeat is stale; waiting for the device to report again." : "Vision telemetry endpoint is wired; waiting for the first simulator/glasses heartbeat."
      },
      alerts:alerts.slice(0, 12),
      capabilities:{ driver_pause_resume:Boolean(driverProfile || latestSession), production_control:false, engine_control:false, vision_heartbeat:true }
    });
  } catch (error:any) {
    console.error("legacy-deck", error?.message || error);
    return Response.json({ error:"LOKIN Legacy Deck unavailable" }, { status:500 });
  }
}
