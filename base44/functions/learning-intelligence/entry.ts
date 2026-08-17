import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const now = () => new Date().toISOString();
const clean = (value, max = 2000) => String(value || "").trim().slice(0, max);

function confidenceFor(positive: number, negative: number, evidence: number) {
  const total = Math.max(1, positive + negative);
  const agreement = Math.max(positive, negative) / total;
  const evidenceWeight = Math.min(1, evidence / 8);
  return Math.max(0.2, Math.min(0.98, 0.45 + agreement * 0.35 + evidenceWeight * 0.18));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action, 40) || "context";
    const userId = user.id;
    const memoriesApi = base44.asServiceRole.entities.LokinLearningMemory;
    const eventsApi = base44.asServiceRole.entities.LokinLearningEvent;
    const profilesApi = base44.asServiceRole.entities.LokinLearningProfile;

    let profiles = await profilesApi.filter({ user_id: userId }, "-updated_date", 1);
    let profile = profiles?.[0] || null;
    if (!profile) {
      profile = await profilesApi.create({
        user_id: userId,
        version: 1,
        learning_enabled: true,
        preferred_response_style: "concise, practical, driver-safe",
        strategy_summary: "Learn only from this user's interactions, feedback, corrections, and outcomes.",
        confidence: 0.5,
        total_events: 0,
        last_learned_at: now(),
      });
    }

    if (action === "context") {
      const memories = await memoriesApi.filter({ user_id: userId, active: true }, "-updated_date", 20);
      return Response.json({ profile, memories, learning_enabled: profile.learning_enabled !== false });
    }

    if (action === "feedback") {
      const rating = Number(body.rating) >= 0 ? 1 : -1;
      const feature = clean(body.feature, 120) || "assistant";
      const inputText = clean(body.input_text, 4000);
      const responseText = clean(body.response_text, 4000);
      const topic = clean(body.topic, 160) || `response:${feature}`;
      const occurredAt = now();

      await eventsApi.create({
        user_id: userId,
        event_type: "feedback",
        feature,
        input_text: inputText,
        response_text: responseText,
        rating,
        metadata_json: JSON.stringify({ source: "assistant-feedback" }),
        occurred_at: occurredAt,
      });

      const existing = await memoriesApi.filter({ user_id: userId, topic, active: true }, "-updated_date", 1);
      const memory = existing?.[0];
      const positive = Number(memory?.positive_count || 0) + (rating > 0 ? 1 : 0);
      const negative = Number(memory?.negative_count || 0) + (rating < 0 ? 1 : 0);
      const evidence = Number(memory?.evidence_count || 0) + 1;
      const summary = rating > 0
        ? `The user found this ${feature} response approach helpful. Prefer similar clarity and decision support when relevant.`
        : `The user found this ${feature} response approach unhelpful. Avoid repeating the same approach; ask for or infer a better strategy from future corrections.`;
      const record = {
        user_id: userId,
        memory_type: rating > 0 ? "strategy" : "correction",
        topic,
        summary,
        confidence: confidenceFor(positive, negative, evidence),
        evidence_count: evidence,
        positive_count: positive,
        negative_count: negative,
        last_evidence_at: occurredAt,
        source: "feedback",
        active: true,
      };
      const saved = memory ? await memoriesApi.update(memory.id, record) : await memoriesApi.create(record);
      profile = await profilesApi.update(profile.id, {
        total_events: Number(profile.total_events || 0) + 1,
        last_learned_at: occurredAt,
        version: Number(profile.version || 1) + 1,
      });
      return Response.json({ ok: true, learned: true, memory: saved, profile });
    }

    if (action === "remember") {
      const memoryType = ["preference", "pattern", "strategy", "correction", "goal", "context"].includes(body.memory_type) ? body.memory_type : "context";
      const topic = clean(body.topic, 160);
      const summary = clean(body.summary, 1500);
      if (!topic || !summary) return Response.json({ error: "topic and summary required" }, { status: 400 });
      const existing = await memoriesApi.filter({ user_id: userId, topic, active: true }, "-updated_date", 1);
      const current = existing?.[0];
      const evidence = Number(current?.evidence_count || 0) + 1;
      const record = {
        user_id: userId,
        memory_type: memoryType,
        topic,
        summary,
        confidence: Math.min(0.98, Number(body.confidence || current?.confidence || 0.65) + Math.min(0.2, evidence * 0.02)),
        evidence_count: evidence,
        positive_count: Number(current?.positive_count || 0),
        negative_count: Number(current?.negative_count || 0),
        last_evidence_at: now(),
        source: body.source === "explicit" ? "explicit" : "interaction",
        active: true,
      };
      const saved = current ? await memoriesApi.update(current.id, record) : await memoriesApi.create(record);
      profile = await profilesApi.update(profile.id, {
        last_learned_at: now(),
        version: Number(profile.version || 1) + 1,
      });
      return Response.json({ ok: true, memory: saved, profile });
    }

    if (action === "set-enabled") {
      const enabled = body.enabled !== false;
      profile = await profilesApi.update(profile.id, { learning_enabled: enabled, last_learned_at: now() });
      return Response.json({ ok: true, learning_enabled: enabled, profile });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("learning-intelligence", error);
    return Response.json({ error: "Learning intelligence unavailable" }, { status: 500 });
  }
}
