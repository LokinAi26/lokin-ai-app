import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const now = () => new Date().toISOString();
const ageMinutes = (value) => value ? (Date.now() - new Date(value).getTime()) / 60000 : 0;
const safeList = async (promise) => { try { return await promise || []; } catch { return []; } };

export default async function(req) {
  const startedAt = now();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = ["scheduled","manual","chatgpt"].includes(body.mode) ? body.mode : "scheduled";
    const [commands, incidents, nativeBuilds] = await Promise.all([
      safeList(base44.asServiceRole.entities.LokinCommandRun.filter({}, "-updated_date", 100)),
      safeList(base44.asServiceRole.entities.LokinCommerceIncident.filter({}, "-updated_date", 100)),
      safeList(base44.asServiceRole.entities.NavigationNativeBuildStatus.filter({}, "-updated_date", 20))
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

    const warnings = openIncidents.length + nativeBlockers.length;
    const score = Math.max(0, 100 - warnings * 10);
    const status = warnings ? (warnings > 3 ? "action_required" : "warning") : "healthy";
    const record = await base44.asServiceRole.entities.LokinOpsRun.create({
      operator:"LOKIN Operations AI",
      app:"LOKIN AI",
      mode,
      status,
      health_score:score,
      checks:{commands_scanned:commands.length, open_commerce_incidents:openIncidents.length, native_build_blockers:nativeBlockers.length},
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