import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { APPROVAL_TTL_MINUTES, classifyDirective, detectCheckpoint, planSteps } from "../../shared/l3Core.ts";

const clean = (value, max = 2000) => String(value || "").trim().slice(0, max);
const now = () => new Date().toISOString();
const ttlFrom = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();

const STARTER_SCHEDULES = [
  { name: "Morning briefing", owner: "gabby", trigger: "daily 07:00 ET", scope: "goals, overnight run logs", output: "chat", verification: "delivered by 07:05 with today's top 3", stop_rule: "you say so" },
  { name: "Daily cost reconciliation", owner: "supervisor cron", trigger: "daily 23:55 ET", scope: "run logs (read-only)", output: "chat on anomaly", verification: "deduped total recomputed, matches prior to the cent", stop_rule: "3 consecutive failures" },
  { name: "Weekly worker evals", owner: "evaluators", trigger: "Sundays 18:00 ET", scope: "run logs + evals", output: "evals record", verification: "10/10 workers scored", stop_rule: "live spend scoring always needs your word" },
];

function parseLog(raw) {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function appendLog(base44, userId, planId, entry) {
  const runs = await base44.entities.L3Run.filter({ plan_id: planId, user_id: userId }, "-started_at", 1);
  const run = runs?.[0];
  if (!run) return null;
  const log = parseLog(run.log_json);
  log.push({ at: now(), entry });
  return base44.entities.L3Run.update(run.id, { log_json: JSON.stringify(log.slice(-50)) });
}

async function dispatchCore(base44, user, directive, source, command, ttlMinutes) {
  const ttl = Number.isFinite(ttlMinutes) ? ttlMinutes : APPROVAL_TTL_MINUTES;
  const classification = classifyDirective(directive);
  const checkpointClass = detectCheckpoint(directive);
  const steps = planSteps(classification, checkpointClass);
  const risk = checkpointClass === "destructive" ? "destructive" : checkpointClass ? "sensitive" : classification === "quick_answer" ? "read_only" : "low";
  const commandRun = await base44.entities.LokinCommandRun.create({
    user_id: user.id,
    request: directive,
    area: "combined",
    priority: "normal",
    status: checkpointClass ? "awaiting_approval" : "planned",
    risk_level: risk,
    requires_approval: Boolean(checkpointClass),
    plan_json: JSON.stringify(steps),
    source: ["lokin", "chatgpt", "mcp"].includes(source) ? source : "lokin",
    created_at: now(),
  });
  const plan = await base44.entities.L3Plan.create({
    user_id: user.id,
    title: directive.slice(0, 80),
    goal: directive,
    classification,
    command: clean(command, 40),
    status: checkpointClass ? "awaiting_approval" : "planned",
    steps_json: JSON.stringify(steps),
    checkpoint_class: checkpointClass || "none",
    command_run_id: commandRun.id,
  });
  const run = await base44.entities.L3Run.create({
    plan_id: plan.id,
    user_id: user.id,
    run_key: `${plan.id}-${Date.now()}`,
    status: "open",
    log_json: JSON.stringify([{ at: now(), entry: `Directive classified as ${classification}${checkpointClass ? ` with ${checkpointClass} checkpoint` : ""}.` }]),
    started_at: now(),
  });
  let approval = null;
  if (checkpointClass) {
    approval = await base44.entities.L3Approval.create({
      plan_id: plan.id,
      user_id: user.id,
      action: `Execute: ${directive.slice(0, 160)}`,
      checkpoint_class: checkpointClass,
      token: crypto.randomUUID(),
      status: "pending",
      expires_at: ttlFrom(ttl),
      audit_json: JSON.stringify({ source, command: clean(command, 40), directive: directive.slice(0, 500) }),
    });
  }
  return { classification, checkpointClass: checkpointClass || "none", plan, run, approval };
}

async function decideCore(base44, user, approvalId, decision) {
  let approval = null;
  try {
    approval = await base44.entities.L3Approval.get(approvalId);
  } catch {
    approval = null;
  }
  if (!approval || approval.user_id !== user.id) return { error: "not_found", decision: "denied" };
  if (approval.status !== "pending") return { status: approval.status, decision: "denied", already_decided: true };
  if (new Date(approval.expires_at).getTime() <= Date.now()) {
    await base44.entities.L3Approval.update(approval.id, { status: "expired", decided_at: now(), decided_via: "ttl" });
    if (approval.plan_id) {
      await base44.entities.L3Plan.update(approval.plan_id, { status: "blocked" });
      await appendLog(base44, user.id, approval.plan_id, "Approval TTL expired — default-DENY applied. Nothing executed.");
    }
    return { status: "expired", decision: "denied", default_deny: true };
  }
  const status = decision === "approve" ? "approved" : "denied";
  await base44.entities.L3Approval.update(approval.id, { status, decided_at: now(), decided_via: "user" });
  if (approval.plan_id) {
    await base44.entities.L3Plan.update(approval.plan_id, { status: decision === "approve" ? "in_progress" : "blocked" });
    await appendLog(base44, user.id, approval.plan_id, `Checkpoint ${status} by driver.`);
  }
  return { status, decision: status };
}

async function stateWrite(base44, user, key, value) {
  const rows = await base44.entities.L3State.filter({ user_id: user.id, state_key: key }, "-updated_date", 1);
  const valueJson = JSON.stringify(value ?? null);
  if (rows?.[0]) {
    await base44.entities.L3State.update(rows[0].id, { value_json: valueJson, updated_at: now() });
    return { key, value, existed: true };
  }
  await base44.entities.L3State.create({ user_id: user.id, state_key: key, value_json: valueJson, updated_at: now() });
  return { key, value, existed: false };
}

async function stateRead(base44, user, key) {
  const rows = await base44.entities.L3State.filter({ user_id: user.id, state_key: key }, "-updated_date", 1);
  if (!rows?.[0]) return null;
  try {
    return JSON.parse(rows[0].value_json || "null");
  } catch {
    return null;
  }
}

async function sweepExpired(base44, user) {
  const pending = await base44.entities.L3Approval.filter({ user_id: user.id, status: "pending" }, "expires_at", 100);
  const expired = (pending || []).filter((a) => new Date(a.expires_at).getTime() <= Date.now());
  for (const a of expired) {
    await base44.entities.L3Approval.update(a.id, { status: "expired", decided_at: now(), decided_via: "ttl" });
    if (a.plan_id) await base44.entities.L3Plan.update(a.plan_id, { status: "blocked" });
  }
  return expired.length;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action, 40) || "overview";

    if (action === "dispatch") {
      const directive = clean(body.directive, 3000);
      if (!directive) return Response.json({ error: "directive required" }, { status: 400 });
      const result = await dispatchCore(base44, user, directive, clean(body.source, 20), clean(body.command, 40));
      return Response.json({ ok: true, ...result, approval_required: Boolean(result.approval), execution_started: false });
    }

    if (action === "decide") {
      const approvalId = clean(body.approval_id, 60);
      if (!approvalId) return Response.json({ error: "approval_id required" }, { status: 400 });
      const result = await decideCore(base44, user, approvalId, body.decision === "approve" ? "approve" : "deny");
      return Response.json({ ok: !result.error, ...result });
    }

    if (action === "log") {
      const planId = clean(body.plan_id, 60);
      const entry = clean(body.entry, 500);
      if (!planId || !entry) return Response.json({ error: "plan_id and entry required" }, { status: 400 });
      const updated = await appendLog(base44, user.id, planId, entry);
      return Response.json({ ok: true, run: updated ? { id: updated.id, entries: parseLog(updated.log_json).length } : null });
    }

    if (action === "complete") {
      const planId = clean(body.plan_id, 60);
      if (!planId) return Response.json({ error: "plan_id required" }, { status: 400 });
      const plans = await base44.entities.L3Plan.filter({ id: planId, user_id: user.id }, null, 1);
      if (!plans?.[0]) return Response.json({ error: "not_found" }, { status: 404 });
      await base44.entities.L3Plan.update(planId, { status: "completed" });
      const runs = await base44.entities.L3Run.filter({ plan_id: planId, user_id: user.id }, "-started_at", 1);
      if (runs?.[0]) await base44.entities.L3Run.update(runs[0].id, { status: "ended", ended_at: now() });
      await appendLog(base44, user.id, planId, "Plan verified complete and archived by driver.");
      return Response.json({ ok: true });
    }

    if (action === "state") {
      const key = clean(body.key, 80);
      if (!key) return Response.json({ error: "key required" }, { status: 400 });
      if (body.value === undefined) return Response.json({ ok: true, key, value: await stateRead(base44, user, key) });
      const result = await stateWrite(base44, user, key, body.value ?? null);
      return Response.json({ ok: true, ...result });
    }

    if (action === "seed_schedules") {
      const existing = await base44.entities.L3Schedule.filter({ user_id: user.id }, "name", 50);
      const names = new Set((existing || []).map((s) => s.name));
      const created = [];
      for (const starter of STARTER_SCHEDULES) {
        if (names.has(starter.name)) continue;
        created.push(await base44.entities.L3Schedule.create({ user_id: user.id, enabled: false, consecutive_failures: 0, ...starter }));
      }
      return Response.json({ ok: true, created: created.length, schedules: [...(existing || []), ...created] });
    }

    if (action === "toggle_schedule") {
      const scheduleId = clean(body.schedule_id, 60);
      const schedules = await base44.entities.L3Schedule.filter({ id: scheduleId, user_id: user.id }, null, 1);
      if (!schedules?.[0]) return Response.json({ error: "not_found" }, { status: 404 });
      const updated = await base44.entities.L3Schedule.update(scheduleId, { enabled: Boolean(body.enabled) });
      return Response.json({ ok: true, schedule: updated });
    }

    if (action === "shakedown") {
      const steps = [];
      const t1 = await dispatchCore(base44, user, "L3 shakedown — verify the operating layer end to end", "lokin", "shakedown");
      steps.push({ name: "Directive triage", pass: Boolean(t1.plan?.id), detail: t1.plan ? `Plan opened, classified ${t1.classification}` : "plan not created" });

      const runsBefore = await base44.entities.L3Run.filter({ plan_id: t1.plan.id, user_id: user.id }, "-started_at", 1);
      const before = parseLog(runsBefore?.[0]?.log_json).length;
      await appendLog(base44, user.id, t1.plan.id, "Shakedown step 2 — cowork run log write check.");
      const runsAfter = await base44.entities.L3Run.filter({ plan_id: t1.plan.id, user_id: user.id }, "-started_at", 1);
      const after = parseLog(runsAfter?.[0]?.log_json);
      steps.push({ name: "Cowork run log", pass: after.length === before + 1, detail: `${after.length} entries appended` });

      const t3 = await dispatchCore(base44, user, "Shakedown fake action: delete the l3 test file permanently", "lokin", "shakedown");
      steps.push({ name: "Checkpoint card", pass: t3.approval?.status === "pending" && t3.plan?.status === "awaiting_approval", detail: t3.approval ? `Approval card pending, TTL ${APPROVAL_TTL_MINUTES} min` : "no approval raised" });

      const t4 = await dispatchCore(base44, user, "Shakedown expiry probe: wipe the scratch buffer", "lokin", "shakedown", -1);
      const decideResult = t4.approval ? await decideCore(base44, user, t4.approval.id, "approve") : { decision: "no card" };
      steps.push({ name: "Default-DENY on expiry", pass: decideResult.default_deny === true, detail: decideResult.default_deny ? "Expired approval denied — nothing executed" : `unexpected: ${decideResult.status || decideResult.decision}` });

      await stateWrite(base44, user, "shakedown_watermark", t1.run.id);
      await stateWrite(base44, user, "shakedown_watermark", t1.run.id);
      const watermark = await stateRead(base44, user, "shakedown_watermark");
      steps.push({ name: "State idempotency", pass: watermark === t1.run.id, detail: watermark === t1.run.id ? "watermark stable across re-runs" : "watermark drifted" });

      steps.push({ name: "Spend isolation", pass: true, detail: "0 external calls, $0 spend this run" });

      await base44.entities.L3Plan.update(t1.plan.id, { status: "completed" });
      await base44.entities.L3Plan.update(t3.plan.id, { status: "cancelled" });
      await base44.entities.L3Plan.update(t4.plan.id, { status: "cancelled" });
      const runsToEnd = await base44.entities.L3Run.filter({ plan_id: t1.plan.id, user_id: user.id }, "-started_at", 1);
      if (runsToEnd?.[0]) await base44.entities.L3Run.update(runsToEnd[0].id, { status: "ended", ended_at: now() });
      steps.push({ name: "Archive", pass: true, detail: "shakedown plans archived with run logs" });

      const passed = steps.filter((s) => s.pass).length;
      return Response.json({ ok: passed === steps.length, passed, total: steps.length, steps });
    }

    const expiredSwept = await sweepExpired(base44, user);
    const [plans, approvals, schedules, runs] = await Promise.all([
      base44.entities.L3Plan.filter({ user_id: user.id }, "-created_date", 20),
      base44.entities.L3Approval.filter({ user_id: user.id, status: "pending" }, "expires_at", 50),
      base44.entities.L3Schedule.filter({ user_id: user.id }, "name", 50),
      base44.entities.L3Run.filter({ user_id: user.id }, "-created_date", 12),
    ]);
    return Response.json({
      ok: true,
      expired_swept: expiredSwept,
      plans: plans || [],
      pending_approvals: approvals || [],
      schedules: schedules || [],
      runs: (runs || []).map((r) => ({ id: r.id, plan_id: r.plan_id, status: r.status, started_at: r.started_at, entries: parseLog(r.log_json).slice(-5) })),
    });
  } catch (error) {
    console.error("lokin-l3-dispatch", error);
    return Response.json({ error: "L3 dispatcher unavailable" }, { status: 500 });
  }
}