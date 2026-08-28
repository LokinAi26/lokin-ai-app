import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const ENGINE_IDS = ["pulse", "forge", "atlas", "sentinel", "governor"];
const ACTIVE_PRODUCTION = new Set(["awaiting_approval", "setup_required", "queued", "running", "qc", "blocked"]);
const ACTIVE_DISPATCH = new Set(["offered", "accepted", "en_route_pickup", "picked_up", "in_transit"]);
const HEALTHY = new Set(["ok", "healthy", "online", "pass", "passed", "ready", "active"]);

const now = () => new Date().toISOString();
const clean = (value:any, max=160) => String(value ?? "").trim().slice(0, max);
const num = (value:any) => Number.isFinite(Number(value)) ? Number(value) : 0;
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
      const rows:any[] = await safe(base44.asServiceRole.entities.TruckDriverProfile.filter({ user_id:user.id }, "-updated_date", 1), []);
      const profile = rows?.[0];
      if (!profile) return Response.json({ error:"No truck driver profile exists yet. Open Dispatch once to configure it before using pause/resume." }, { status:409 });
      const status = action === "driver_pause" ? "paused" : "available";
      const updated = await base44.asServiceRole.entities.TruckDriverProfile.update(profile.id, { status, updated_at:now() });
      return Response.json({ ok:true, status, profile_id:updated.id, generated_at:now() });
    }

    if (action !== "snapshot") return Response.json({ error:"Unsupported action" }, { status:400 });

    const admin = user.role === "admin";
    const [earnings, assignments, profiles, jobs, pulses, workload] = await Promise.all([
      safe(base44.asServiceRole.entities.Earning.filter({ created_by_id:user.id }, "-date", 31), []),
      safe(base44.asServiceRole.entities.DispatchAssignment.filter({ user_id:user.id }, "-assigned_at", 50), []),
      safe(base44.asServiceRole.entities.TruckDriverProfile.filter({ user_id:user.id }, "-updated_date", 1), []),
      safe(base44.asServiceRole.entities.OasisProductionJob.filter({ owner_user_id:user.id }, "-created_at", 80), []),
      admin ? safe(base44.asServiceRole.entities.LokinSystemPulse.filter({}, "-checked_at", 80), []) : Promise.resolve([]),
      admin ? safe(base44.asServiceRole.entities.EcosystemWorkloadDecision.filter({}, "-decided_at", 120), []) : Promise.resolve([]),
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
      const row:any = engineMap[id] || null;
      return {
        id,
        name: row?.engine_name || id.toUpperCase(),
        status: row?.status || "no_signal",
        operation: row?.operation || null,
        provider: row?.provider || null,
        accepted: row?.accepted === true,
        last_decision_at: row?.decided_at || null,
        error: row?.error || null,
      };
    });

    const alerts:any[] = [];
    for (const row of unhealthyComponents.slice(0, 5)) alerts.push({ severity:"warning", title:`${row.component} health`, detail:`Status: ${row.status}` });
    for (const job of failedJobs.slice(0, 5)) alerts.push({ severity:"critical", title:"Production job requires attention", detail:clean(job.error_message || job.error_code || job.status, 220), id:job.id });
    const engineFailures = engines.filter((e:any) => ["failed", "cancelled"].includes(e.status));
    for (const engine of engineFailures) alerts.push({ severity:"warning", title:`${engine.name} engine`, detail:engine.error || `Latest workload status: ${engine.status}` });

    const systemStatus = unhealthyComponents.length || failedJobs.length ? "DEGRADED" : "ONLINE";
    const driverProfile:any = profiles?.[0] || null;

    return Response.json({
      ok:true,
      deck_version:"1.0.0",
      generated_at:now(),
      user:{ name:user.full_name || user.name || user.email || "LOKIN Operator", email:user.email || "", role:user.role || "user" },
      system:{ status:systemStatus, components:componentHealth, alert_count:alerts.length },
      driver:{ status:driverProfile?.status || "not_configured", active_assignments:activeAssignments.length, latest_assignment:activeAssignments?.[0] || assignments?.[0] || null },
      earnings:{ latest_date:latestEarningDate, amount:Number(earningTotal.toFixed(2)), trips },
      productions:{ active:activeJobs.length, qc:qcJobs.length, failed:failedJobs.length, latest:(jobs || []).slice(0, 5) },
      engines,
      vision:{ status:"NOT_CONNECTED", telemetry:false, detail:"LOKIN Vision telemetry source is not registered in the LOKIN AI app yet." },
      alerts:alerts.slice(0, 12),
      capabilities:{ driver_pause_resume:Boolean(driverProfile), production_control:false, engine_control:false }
    });
  } catch (error:any) {
    console.error("legacy-deck", error?.message || error);
    return Response.json({ error:"LOKIN Legacy Deck unavailable" }, { status:500 });
  }
}
