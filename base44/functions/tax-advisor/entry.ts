import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// LOKIN AI Tax Advisor & Credit Engine.
// Reads the user's own earnings, mileage, expenses, and credit goal, computes
// YTD totals + deductions at the current IRS standard mileage rates, then calls
// the LLM for structured tax guidance (or credit-building tips).

const IRS_RATE = { business: 0.7, medical: 0.21, charitable: 0.14, moving: 0.21, personal: 0 };
const YEAR = new Date().getFullYear();

function round(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function taxSchema() {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      estimated_tax_owed: { type: "number" },
      estimated_quarterly_payment: { type: "number" },
      effective_rate_pct: { type: "number" },
      top_deductions: {
        type: "array",
        items: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, why: { type: "string" } } }
      },
      missed_deductions: { type: "array", items: { type: "string" } },
      tips: { type: "array", items: { type: "string" } }
    }
  };
}

function creditSchema() {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      score_projection: { type: "string" },
      utilization_advice: { type: "string" },
      tips: { type: "array", items: { type: "string" } },
      next_steps: { type: "array", items: { type: "string" } }
    }
  };
}

function buildTaxPrompt(s) {
  return `You are LOKIN AI's tax advisor for a US gig-economy driver (1099 independent contractor).
Use 2025 US federal self-employment tax rules: 15.3% SE tax on net earnings + income tax (assume 12% bracket single filer).
The user's year-to-date financials:
- Gross income: $${s.income.toFixed(2)}
- Business miles driven: ${s.businessMiles} (IRS standard rate $0.70/mile)
- Mileage deduction: $${s.mileageDeduction.toFixed(2)}
- Deductible expenses by category: ${JSON.stringify(s.byCategory)} (total $${s.expenseDeduction.toFixed(2)})
- Total deductions: $${s.totalDeductions.toFixed(2)}
- Estimated net (taxable) income: $${s.netIncome.toFixed(2)}

Give a concise, actionable tax plan. Return ONLY the JSON matching the schema:
- summary: 1-2 sentence overview
- estimated_tax_owed: total federal tax (SE + income) as a number
- estimated_quarterly_payment: what to set aside per quarter as a number
- effective_rate_pct: overall effective tax rate as a number
- top_deductions: the 3-4 biggest deductions available to this driver, each with name, amount, and why
- missed_deductions: deductions they are likely missing (short strings)
- tips: 3-5 short money-saving filing tips`;
}

function buildCreditPrompt(g, income, netIncome) {
  return `You are LOKIN AI's credit-building coach for a gig-economy driver.
Current credit profile:
- Current score: ${g.current_score ?? "unknown"}
- Goal score: ${g.goal_score ?? "700+"}
- Credit utilization: ${g.utilization_pct ?? "unknown"}%
- On-time payment streak: ${g.on_time_streak ?? 0} months
- Net monthly income (approx): $${Math.round((netIncome || income) / 12).toFixed(0)}

Return ONLY JSON matching the schema with a realistic, month-by-month friendly plan to raise the score.
- summary: current standing in 1-2 sentences
- score_projection: how many points and months to realistically reach the goal
- utilization_advice: specific utilization target and how to get there
- tips: 4-6 short actionable tips
- next_steps: 2-3 immediate actions this week`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const mode = (payload.mode || "tax").toLowerCase();

    const [earnings, miles, expenses, goals] = await Promise.all([
      base44.entities.Earning.filter({}, "-date", 500),
      base44.entities.MileageLog.filter({}, "-date", 500),
      base44.entities.Expense.filter({}, "-date", 500),
      base44.entities.CreditGoal.filter({}, "-updated_date", 10),
    ]);

    const ytdEarnings = (earnings || []).filter((e) => (e.date || "").startsWith(String(YEAR)));
    const income = round(ytdEarnings.reduce((s, e) => s + (Number(e.amount) || 0), 0));

    const businessMiles = round((miles || []).filter((m) => m.type === "business").reduce((s, m) => s + (Number(m.miles) || 0), 0));
    const mileageDeduction = round((miles || []).reduce((s, m) => s + (Number(m.miles) || 0) * (IRS_RATE[m.type] || 0), 0));

    const dedExpenses = (expenses || []).filter((e) => e.deductible !== false);
    const byCategory = {};
    for (const e of dedExpenses) byCategory[e.category] = round((byCategory[e.category] || 0) + (Number(e.amount) || 0));
    const expenseDeduction = round(dedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));

    const totalDeductions = round(mileageDeduction + expenseDeduction);
    const netIncome = round(Math.max(0, income - totalDeductions));
    const summary = { income, businessMiles, mileageDeduction, expenseDeduction, totalDeductions, netIncome, byCategory };

    if (mode === "credit") {
      const g = (goals || [])[0] || {};
      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildCreditPrompt(g, income, netIncome),
        response_json_schema: creditSchema(),
      });
      return Response.json({ credit: llm, profile: g });
    }

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: buildTaxPrompt({ ...summary }),
      response_json_schema: taxSchema(),
    });
    return Response.json({ advisor: llm, summary });
  } catch (error) {
    console.error("tax-advisor error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}