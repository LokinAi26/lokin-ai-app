// LOKIN Driver Opportunity Hub — on-demand AI recommendation.
// Credit-efficient: only runs when a driver explicitly requests a comparison.
// Receives selected (or filtered) opportunity ids + the driver's goals, and
// returns a structured recommendation explaining the best matches.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Optional auth — the hub is reachable by any logged-in driver.
    let user = null;
    try { user = await base44.auth.me(); } catch {}

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.opportunity_ids) ? body.opportunity_ids.filter(Boolean) : [];
    const goals = body.goals || {};

    // Load opportunities. If ids given, fetch and filter; otherwise use the most recent 12.
    let opps = [];
    if (ids.length) {
      const all = await base44.entities.OpportunityScan.list("-scan_date", 120);
      opps = all.filter((o) => ids.includes(o.id));
    } else {
      opps = await base44.entities.OpportunityScan.list("-scan_date", 12);
    }
    if (!opps.length) {
      return Response.json({ error: "No opportunities to compare" }, { status: 400 });
    }

    const summary = opps.map((o, i) => ({
      index: i + 1,
      title: o.title,
      company: o.company || o.platform || "",
      category: o.category,
      role_type: o.role_type,
      pay: o.pay,
      pay_amount: o.pay_amount,
      pay_source: o.pay_source,
      employment_type: o.employment_type,
      schedule: o.schedule,
      est_weekly_hours: o.est_weekly_hours,
      est_weekly_miles: o.est_weekly_miles,
      vehicle_requirements: o.vehicle_requirements,
      location: o.location,
    }));

    const prompt = `You are LOKIN AI's driver opportunity advisor. A driver wants to know which opportunities best match their goals.

Driver goals:
- Minimum target: $${goals.min_per_hour ?? 22}/hour net
- Weekly income goal: $${goals.weekly_goal ?? 850}
- Vehicle: ${goals.vehicle_type ?? "personal_car"}
- Driver type: ${goals.user_type ?? "driver"}
- Max miles per shift: ${goals.max_miles ?? 12}

Opportunities (JSON array):
${JSON.stringify(summary, null, 2)}

Rules:
- Be honest and specific. Distinguish W-2 employment (taxes withheld, benefits possible) from 1099/gig (contractor, self-employment taxes, flexibility).
- Pay is advertised/estimated, NEVER guaranteed — say so if relevant.
- Estimate gross vs likely vehicle expenses (use ~$0.67/mile if no driver mileage cost given) and net per hour where possible.
- Note flexibility and tradeoffs vs the driver's goals.

Pick the best 1-3 matches. Return JSON: top_match_index (1-based int), recommendation (3-5 sentences, plain language), alternatives (array of {index, reason}).`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          top_match_index: { type: "number" },
          recommendation: { type: "string" },
          alternatives: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "number" },
                reason: { type: "string" },
              },
            },
          },
        },
        required: ["recommendation"],
      },
    });

    return Response.json({
      ok: true,
      recommendation: llm?.recommendation || "",
      top_match_index: llm?.top_match_index || 1,
      alternatives: Array.isArray(llm?.alternatives) ? llm.alternatives : [],
    });
  } catch (error) {
    console.error("opportunity-recommend error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}