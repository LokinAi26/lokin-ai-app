import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { controlPlaneHealth } from "../../shared/unifiedControlPlane.js";

const now = () => new Date().toISOString();
const ageMinutes = (value) => value ? (Date.now() - new Date(value).getTime()) / 60000 : 0;
const safeList = async (promise) => { try { return await promise || []; } catch { return []; } };

export default async function(req) {
  const startedAt = now();
  try {
    const base44 = createClientFromRequest(req);
    // Internal operations endpoint: only the scheduled workflow runtime (which
    // authenticates as the app owner) or an admin may run operational scans.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const mode = ["scheduled","manual","chatgpt"].includes(body.mode) ? body.mode : "scheduled";
    const [commands, incidents, nativeBuilds, trackedTasks, controlHealth] = await Promise.all([
      safeList(base44.asServiceRole.entities.LokinCommandRun.filter({}, "-updated_date", 100)),
      safeList(base44.asServiceRole.entities.LokinCommerceIncident.filter({}, "-updated_date", 100)),
      safeList(base44.asServiceRole.entities.NavigationNativeBuildStatus.filter({}, "-updated_date", 20)),
      safeList(base44.asServiceRole.entities.Base44BuildTask.filter({}, "-updated_date", 500)),
      controlPlaneHealth(base44, { namespace:"lokin", source_app:"LOKIN AI" }, { service:true, role:"admin", userId:"LOKIN_OPERATIONS_AI" }).catch(() => ({ status:"warning", health_score:80, conflicts:[], duplicates:[], expired:0, active_states:0 }))
    ]);

    const repairs = [];
    const approvals = [];
    for (const run of commands) {
      if (run.status === "in_progress" && ageMinutes(run.updated_date || run.created_at) > 60) {
        await base44.asServiceRole.entities.LokinCommandRun.update(run.id, {
          status: "blocked",
          completed_at: now()
        });
        repairs.push({type:"release_stale_command", record_id:run.id, reversible:true});
      }
    }

    const openIncidents = incidents.filter((x) => !["resolved","closed","completed"].includes(String(x.status || "").toLowerCase()));
    for (const incident of openIncidents.slice(0, 20)) {
      approvals.push({type:"commerce_incident", record_id:incident.id, reason:"Commerce mutations require review."});
    }
    const nativeBlockers = nativeBuilds.filter((x) => /fail|block|required/i.test(String(x.status || "") + " " + String(x.last_error || "")));
    for (const item of nativeBlockers.slice(0, 10)) {
      approvals.push({type:"native_build", record_id:item.id, reason:"Native shell changes require compilation and physical-device verification."});
    }

    const taskCounts = { queued:0, running:0, blocked:0, completed:0, failed:0, canceled:0 };
    let progressTotal = 0;
    let progressRows = 0;
    for (const task of trackedTasks) {
      const s = String(task.status || "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(taskCounts, s)) taskCounts[s] += 1;
      if (s !== "canceled") {
        progressTotal += Math.max(0, Math.min(100, Number(task.progress_percent || 0)));
        progressRows += 1;
      }
      if (s === "blocked" || s === "failed") approvals.push({type:"build_task", record_id:task.id, reason:task.last_error || `Tracked Base44 task is ${s}.`});
    }
    const taskRemaining = taskCounts.queued + taskCounts.running + taskCounts.blocked + taskCounts.failed;
    const taskProgress = progressRows ? Math.round((progressTotal / progressRows) * 100) / 100 : 100;

    for (const conflict of controlHealth.conflicts || []) approvals.push({type:"control_state_conflict", record_id:conflict.key, reason:"Canonical state conflict is fail-closed and requires explicit resolution."});
    const warnings = openIncidents.length + nativeBlockers.length + taskCounts.blocked + taskCounts.failed + (controlHealth.duplicates?.length || 0) + (controlHealth.expired || 0);
    const critical = (controlHealth.conflicts?.length || 0) > 0;
    const score = Math.max(0, Math.min(Number(controlHealth.health_score ?? 100), 100 - warnings * 6 - (critical ? 20 : 0)));
    const status = critical || warnings > 3 ? "action_required" : warnings ? "warning" : "healthy";
    const record = await base44.asServiceRole.entities.LokinOpsRun.create({
      operator:"LOKIN Operations AI",
      app:"LOKIN AI",
      mode,
      status,
      health_score:score,
      checks:{commands_scanned:commands.length, open_commerce_incidents:openIncidents.length, native_build_blockers:nativeBlockers.length, build_tasks:{tracked:trackedTasks.length, remaining:taskRemaining, progress_percent:taskProgress, ...taskCounts, coverage_mode:"connection_tracked", platform_internal_queue_visible:false}, control_plane:{status:controlHealth.status, active_states:controlHealth.active_states, conflicts:controlHealth.conflicts?.length || 0, duplicates:controlHealth.duplicates?.length || 0, expired:controlHealth.expired || 0}},
      repairs,
      approvals_required:approvals,
      started_at:startedAt,
      completed_at:now()
    });
    return Response.json({ok:true, run_id:record.id, status, health_score:score, checks:record.checks, repairs, approvals_required:approvals});
  } catch (error) {
    console.error("lokin-ops-operator", error);
    return Response.json({ok:false, status:"failed", error:"Operations scan failed safely."},{status:500});
  }
}