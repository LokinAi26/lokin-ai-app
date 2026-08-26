import { createClientFromRequest } from "npm:@base44/sdk";

const ACTIONS = new Set(["accepted", "dismissed", "expired", "completed", "cancelled"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function optionalNumber(value: unknown, min: number, max: number) {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Value must be between ${min} and ${max}`);
  return number;
}

export default async function sealFeedback(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);

    const body = await req.json().catch(() => ({}));
    const decisionId = String(body?.decision_id || "").trim();
    const selectedAction = String(body?.selected_action || "").trim();
    if (!decisionId || !ACTIONS.has(selectedAction)) {
      return json({ error: "A valid decision and outcome action are required", code: "INVALID_FEEDBACK" }, 400);
    }

    const decision = await base44.asServiceRole.entities.SealDecision.get(decisionId);
    if (!decision || String(decision.user_id) !== String(user.id)) {
      return json({ error: "SEAL decision not found", code: "DECISION_NOT_FOUND" }, 404);
    }

    const values = {
      user_id: String(user.id),
      decision_id: decisionId,
      subject_id: String(decision.subject_id),
      selected_action: selectedAction,
      actual_payout: optionalNumber(body?.actual_payout, 0, 5000),
      actual_minutes: optionalNumber(body?.actual_minutes, 0, 2880),
      actual_miles: optionalNumber(body?.actual_miles, 0, 2000),
      actual_wait_minutes: optionalNumber(body?.actual_wait_minutes, 0, 1440),
      driver_rating: optionalNumber(body?.driver_rating, 1, 5),
      notes: String(body?.notes || "").trim().slice(0, 500),
      recorded_at: new Date().toISOString(),
    };

    const existing = await base44.entities.SealFeedback.filter({
      decision_id: decisionId,
      subject_id: String(decision.subject_id),
    });
    const feedback = existing[0]
      ? await base44.entities.SealFeedback.update(existing[0].id, values)
      : await base44.entities.SealFeedback.create(values);

    const signalType = ["accepted", "completed"].includes(selectedAction)
      ? "accepted_recommendation"
      : "dismissed_recommendation";
    await base44.entities.DriverLearningSignal.create({
      user_id: String(user.id),
      signal_type: signalType,
      feature_key: "lokin_seal",
      value: {
        decision_id: decisionId,
        offer_id: String(decision.subject_id),
        selected_action: selectedAction,
        predicted_score: Number(decision.score || 0),
        predicted_confidence: Number(decision.confidence_score || 0),
        actual_payout: values.actual_payout,
        actual_minutes: values.actual_minutes,
        actual_miles: values.actual_miles,
        actual_wait_minutes: values.actual_wait_minutes,
        driver_rating: values.driver_rating,
        engine_version: decision.engine_version,
        policy_version: decision.policy_version,
      },
      weight: selectedAction === "completed" ? 1 : 0.6,
      recorded_at: values.recorded_at,
    });

    return json({
      ok: true,
      feedback_id: feedback.id,
      learn_status: "recorded",
      disclosure: "Feedback updates the driver's learning signals; it does not change third-party platform state.",
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Could not record SEAL feedback",
      code: "SEAL_FEEDBACK_FAILED",
    }, 400);
  }
}
