import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const now = () => new Date().toISOString();
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function summarize(events, cfg) {
  let input = 0, output = 0, total = 0, cost = 0, calls = 0, failures = 0;
  for (const e of events || []) {
    input += num(e.input_tokens);
    output += num(e.output_tokens);
    total += num(e.total_tokens);
    cost += num(e.estimated_cost_usd);
    calls += 1;
    if (e.status === "provider_error") failures += 1;
  }
  const budget = num(cfg?.monthly_budget_usd);
  const starting = num(cfg?.starting_credit_usd);
  const percent = budget > 0 ? Math.min(999, (cost / budget) * 100) : 0;
  const remainingBudget = budget > 0 ? Math.max(0, budget - cost) : null;
  const estimatedCreditRemaining = starting > 0 ? Math.max(0, starting - cost) : null;
  const warnAt = num(cfg?.warning_percent, 70);
  const preserveAt = num(cfg?.preservation_percent, 90);
  let mode = "normal";
  if (budget > 0 && percent >= 100 && cfg?.block_when_over_budget) mode = "block";
  else if (budget > 0 && percent >= preserveAt) mode = "preserve";
  else if (budget > 0 && percent >= warnAt) mode = "warn";
  return {
    calls,
    failures,
    input_tokens: input,
    output_tokens: output,
    total_tokens: total,
    estimated_spend_usd: Number(cost.toFixed(6)),
    monthly_budget_usd: budget,
    budget_used_percent: Number(percent.toFixed(2)),
    remaining_budget_usd: remainingBudget === null ? null : Number(remainingBudget.toFixed(6)),
    starting_credit_usd: starting,
    estimated_credit_remaining_usd: estimatedCreditRemaining === null ? null : Number(estimatedCreditRemaining.toFixed(6)),
    mode,
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const cfgApi = base44.asServiceRole.entities.OpenAIGuardianConfig;
    const usageApi = base44.asServiceRole.entities.OpenAIUsageEvent;
    const rows = await cfgApi.filter({ user_id: user.id }, "-updated_date", 1);
    let cfg = rows?.[0] || null;

    if (!cfg) {
      cfg = await cfgApi.create({
        user_id: user.id,
        monthly_budget_usd: 0,
        starting_credit_usd: 0,
        input_rate_per_million: 0,
        output_rate_per_million: 0,
        warning_percent: 70,
        preservation_percent: 90,
        block_when_over_budget: false,
        enabled: true,
        notes: "Enter your OpenAI pricing rates and optional prepaid balance to enable local cost estimates. LOKIN never exposes the API key to the browser.",
      });
    }

    if (action === "save-config") {
      const warningPercent = Math.min(100, Math.max(1, num(body.warning_percent, 70)));
      const preservationPercent = Math.min(100, Math.max(1, num(body.preservation_percent, 90)));
      if (preservationPercent <= warningPercent) {
        return Response.json({ error: "Preservation threshold must be higher than warning threshold." }, { status: 400 });
      }
      const update = {
        monthly_budget_usd: Math.max(0, num(body.monthly_budget_usd)),
        starting_credit_usd: Math.max(0, num(body.starting_credit_usd)),
        input_rate_per_million: Math.max(0, num(body.input_rate_per_million)),
        output_rate_per_million: Math.max(0, num(body.output_rate_per_million)),
        warning_percent: warningPercent,
        preservation_percent: preservationPercent,
        block_when_over_budget: body.block_when_over_budget === true,
        enabled: body.enabled !== false,
      };
      cfg = await cfgApi.update(cfg.id, update);
    }

    const events = await usageApi.filter({ user_id: user.id, occurred_at: { $gte: monthStart() } }, "-occurred_at", 500);
    const summary = summarize(events, cfg);
    return Response.json({
      configured: Boolean(secrets.get("OPENAI_API_KEY")),
      model: secrets.get("OPENAI_MODEL") || "configured-default",
      low_cost_model_configured: Boolean(secrets.get("OPENAI_LOW_COST_MODEL")),
      api_key_exposed: false,
      config: cfg,
      summary,
      recent: (events || []).slice(0, 20),
      generated_at: now(),
    });
  } catch (e) {
    console.error("openai-usage-guardian", e);
    return Response.json({ error: "OpenAI usage guardian unavailable" }, { status: 500 });
  }
}
