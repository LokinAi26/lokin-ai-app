import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const clean = (value, max = 2000) => String(value || "").trim().slice(0, max);
const now = () => new Date().toISOString();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

const SKILLS = Object.freeze([
  { id: "base44_health", area: "base44", mode: "read_only", title: "Base44 Health", description: "Checks app integrations, launch systems, and known operational blockers." },
  { id: "base44_plan", area: "base44", mode: "plan", title: "Base44 Build Planner", description: "Creates a checkpoint-first implementation and verification plan." },
  { id: "credit_guardian", area: "openai", mode: "read_only", title: "OpenAI Credit Guardian", description: "Summarizes estimated usage, budget posture, and preservation status." },
  { id: "model_router", area: "openai", mode: "advisory", title: "Efficient Model Router", description: "Routes ordinary work toward lower-cost capability when configured." },
  { id: "learning_context", area: "openai", mode: "read_only", title: "Learning Context", description: "Surfaces active memories and measured strategies without exposing secrets." },
  { id: "business_brief", area: "business", mode: "read_only", title: "Business Brief", description: "Combines operations, opportunities, commerce, and open priorities." },
  { id: "action_plan", area: "combined", mode: "plan", title: "Action Planner", description: "Turns a goal into ordered, reviewable steps with approval gates." },
  { id: "explicit_memory", area: "combined", mode: "write", title: "Explicit Memory", description: "Saves only a user-requested preference, goal, or project fact." }
]);

function riskFor(text) {
  const value = text.toLowerCase();
  if (/delete|erase|remove all|reset|cancel account/.test(value)) return "destructive";
  if (/pay|purchase|deploy|publish|send|message|email|credential|secret|token|key|refund/.test(value)) return "sensitive";
  if (/check|read|show|summarize|status|list|explain/.test(value)) return "read_only";
  return "low";
}

function planFor(goal, area, risk) {
  const steps = [
    { order: 1, name: "Confirm scope", purpose: "Use the smallest change that satisfies the request.", mode: "read_only" },
    { order: 2, name: "Inspect current state", purpose: area === "base44" ? "Read existing code, configuration, and health before editing." : "Gather only the data needed for this goal.", mode: "read_only" },
    { order: 3, name: "Protect current state", purpose: area === "base44" || area === "combined" ? "Create or confirm a recoverable checkpoint before material changes." : "Preserve the current configuration and record assumptions.", mode: "safety" },
    { order: 4, name: "Execute focused work", purpose: "Perform only approved actions; reuse existing skills, memory, and cached results.", mode: risk },
    { order: 5, name: "Verify outcome", purpose: "Run relevant checks and report evidence, remaining blockers, and rollback path.", mode: "read_only" }
  ];
  return steps;
}

async function context(base44, userId) {
  const [configs, usage, memories, strategies, runs] = await Promise.all([
    base44.asServiceRole.entities.OpenAIGuardianConfig.filter({ user_id: userId }, "-updated_date", 1),
    base44.asServiceRole.entities.OpenAIUsageEvent.filter({ user_id: userId, occurred_at: { $gte: monthStart() } }, "-occurred_at", 500),
    base44.asServiceRole.entities.LokinLearningMemory.filter({ user_id: userId, active: true }, "-updated_date", 12),
    base44.asServiceRole.entities.LokinStrategyPerformance.filter({ user_id: userId, active: true }, "-rank_score", 8),
    base44.asServiceRole.entities.LokinCommandRun.filter({ user_id: userId }, "-created_at", 20)
  ]);
  const config = configs?.[0] || null;
  const spend = (usage || []).reduce((sum, row) => sum + number(row.estimated_cost_usd), 0);
  const budget = number(config?.monthly_budget_usd);
  const used = budget > 0 ? (spend / budget) * 100 : 0;
  const preservation = number(config?.preservation_percent, 90);
  const warning = number(config?.warning_percent, 70);
  const guardianMode = budget > 0 && used >= 100 && config?.block_when_over_budget ? "block"
    : budget > 0 && used >= preservation ? "preserve"
    : budget > 0 && used >= warning ? "warn" : "normal";
  return {
    guardian: {
      configured: Boolean(secrets.get("OPENAI_API_KEY")),
      api_key_exposed: false,
      calls_this_month: usage?.length || 0,
      estimated_spend_usd: Number(spend.toFixed(6)),
      monthly_budget_usd: budget,
      budget_used_percent: Number(used.toFixed(2)),
      mode: guardianMode,
      low_cost_model_configured: Boolean(secrets.get("OPENAI_LOW_COST_MODEL"))
    },
    learning: {
      memories: (memories || []).map(({ memory_type, topic, summary, confidence }) => ({ memory_type, topic, summary, confidence })),
      strategies: (strategies || []).map(({ strategy_key, summary, confidence, rank_score }) => ({ strategy_key, summary, confidence, rank_score }))
    },
    runs: runs || []
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action, 40) || "status";

    if (action === "skills") {
      const area = ["base44", "openai", "business", "combined"].includes(body.area) ? body.area : "";
      return Response.json({ server: "LOKIN Command Server", version: 1, skills: area ? SKILLS.filter((s) => s.area === area || s.area === "combined") : SKILLS });
    }

    const snapshot = await context(base44, user.id);

    if (action === "status") {
      return Response.json({
        server: "LOKIN Command Server",
        version: 1,
        connected_surfaces: ["LOKIN AI", "ChatGPT via Base44 MCP"],
        protections: ["OAuth authentication", "per-user data isolation", "approval gates", "audit trail", "credit guardian", "no browser API keys"],
        guardian: snapshot.guardian,
        learning: { memory_count: snapshot.learning.memories.length, strategy_count: snapshot.learning.strategies.length },
        work: {
          open: snapshot.runs.filter((r) => !["completed", "cancelled"].includes(r.status)).length,
          recent: snapshot.runs.slice(0, 5)
        },
        generated_at: now()
      });
    }

    if (action === "brief") {
      return Response.json({
        title: "LOKIN Daily Command Brief",
        guardian: snapshot.guardian,
        priorities: snapshot.runs.filter((r) => !["completed", "cancelled"].includes(r.status)).slice(0, 5),
        learned_strategies: snapshot.learning.strategies.slice(0, 5),
        active_memories: snapshot.learning.memories.slice(0, 5),
        next_best_action: snapshot.runs.find((r) => !["completed", "cancelled"].includes(r.status)) || null,
        generated_at: now()
      });
    }

    if (action === "plan") {
      const goal = clean(body.goal, 3000);
      if (!goal) return Response.json({ error: "goal required" }, { status: 400 });
      const area = ["base44", "openai", "business", "combined"].includes(body.area) ? body.area : "combined";
      const priority = ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal";
      const risk = riskFor(goal);
      const requiresApproval = risk === "sensitive" || risk === "destructive";
      const steps = planFor(goal, area, risk);
      const run = await base44.asServiceRole.entities.LokinCommandRun.create({
        user_id: user.id,
        request: goal,
        area,
        priority,
        status: requiresApproval ? "awaiting_approval" : "planned",
        risk_level: risk,
        requires_approval: requiresApproval,
        plan_json: JSON.stringify(steps),
        source: ["lokin", "chatgpt", "mcp"].includes(body.source) ? body.source : "mcp",
        created_at: now()
      });
      return Response.json({ ok: true, run, steps, execution_started: false, approval_required: requiresApproval });
    }

    if (action === "remember") {
      const topic = clean(body.topic, 160);
      const summary = clean(body.summary, 1500);
      const type = ["preference", "goal", "context", "strategy", "correction", "pattern"].includes(body.memory_type) ? body.memory_type : "context";
      if (!topic || !summary) return Response.json({ error: "topic and summary required" }, { status: 400 });
      const rows = await base44.asServiceRole.entities.LokinLearningMemory.filter({ user_id: user.id, topic, active: true }, "-updated_date", 1);
      const record = { user_id: user.id, memory_type: type, topic, summary, confidence: 0.95, evidence_count: number(rows?.[0]?.evidence_count) + 1, positive_count: number(rows?.[0]?.positive_count), negative_count: number(rows?.[0]?.negative_count), last_evidence_at: now(), source: "explicit", active: true };
      const memory = rows?.[0] ? await base44.asServiceRole.entities.LokinLearningMemory.update(rows[0].id, record) : await base44.asServiceRole.entities.LokinLearningMemory.create(record);
      return Response.json({ ok: true, saved: true, memory });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("lokin-command-server", error);
    return Response.json({ error: "LOKIN Command Server unavailable" }, { status: 500 });
  }
}
