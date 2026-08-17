import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { jsonRequest } from "../../shared/printRequest.ts";

const OPENAI_URL = "https://api.openai.com/v1/responses";

function compactContext(value) {
  if (!value || typeof value !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (["string", "number", "boolean"].includes(typeof v) && String(v).length <= 500) out[k] = v;
  }
  return out;
}

function systemFor(mode) {
  const common = "You are LOKIN AI, a concise, practical copilot for gig drivers. Be accurate, useful, and brief. Never claim an action was completed unless the app confirms it. Use learned user preferences only as soft personalization, never as authoritative facts. Do not infer sensitive traits. If drafting a customer message, return the draft separately.";
  if (mode === "text") return `${common} Improve the supplied text according to the requested writing mode and tone. Return only JSON.`;
  if (mode === "motivation") return `${common} Give an energetic but grounded pep talk, usually 2-4 sentences. Return only JSON.`;
  if (mode === "support") return `${common} Help troubleshoot the user's LOKIN issue. Prefer concrete steps and avoid inventing account state. Return only JSON.`;
  return `${common} Answer the driver's command using the supplied context and relevant learned preferences. Return only JSON.`;
}

function schemaFor(mode) {
  if (mode === "text") return '{"result":"string","suggestions":["string"]}';
  if (mode === "motivation") return '{"message":"string"}';
  if (mode === "support") return '{"reply":"string"}';
  return '{"reply":"string","draftedMessage":"string or empty"}';
}

function extractText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) {
    for (const c of item?.content || []) if (typeof c?.text === "string") return c.text;
  }
  return "";
}

function compactLearning(memories) {
  return (memories || [])
    .filter((m) => m?.active !== false && Number(m?.confidence || 0) >= 0.45)
    .slice(0, 8)
    .map((m) => ({
      type: m.memory_type,
      topic: String(m.topic || "").slice(0, 160),
      summary: String(m.summary || "").slice(0, 500),
      confidence: Number(m.confidence || 0),
      evidence: Number(m.evidence_count || 0),
    }));
}

function compactStrategies(strategies) {
  return (strategies || [])
    .filter((s) => s?.active !== false && Number(s?.confidence || 0) >= 0.3)
    .slice(0, 6)
    .map((s) => ({
      strategy: String(s.strategy_key || "").slice(0, 180),
      samples: Number(s.sample_count || 0),
      avgNetPerHour: Number(s.avg_net_per_hour || 0),
      avgDollarsPerMile: Number(s.avg_dollars_per_mile || 0),
      successScore: Number(s.avg_success_score || 0),
      confidence: Number(s.confidence || 0),
      rankScore: Number(s.rank_score || 0),
      summary: String(s.summary || "").slice(0, 500),
    }));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = ["assistant", "text", "motivation", "support"].includes(body.mode) ? body.mode : "assistant";
    const apiKey = secrets.get("OPENAI_API_KEY");
    const model = secrets.get("OPENAI_MODEL") || "gpt-5.6";

    let profile = null;
    let learnedMemories = [];
    let learnedStrategies = [];
    try {
      const profiles = await base44.asServiceRole.entities.LokinLearningProfile.filter({ user_id: user.id }, "-updated_date", 1);
      profile = profiles?.[0] || null;
      if (profile?.learning_enabled !== false) {
        const [memories, strategies] = await Promise.all([
          base44.asServiceRole.entities.LokinLearningMemory.filter({ user_id: user.id, active: true }, "-updated_date", 20),
          base44.asServiceRole.entities.LokinStrategyPerformance.filter({ user_id: user.id, active: true }, "-rank_score", 10),
        ]);
        learnedMemories = compactLearning(memories);
        learnedStrategies = compactStrategies(strategies);
      }
    } catch (e) {
      console.warn("learning context unavailable", e?.message || e);
    }

    const safe = {
      command: String(body.command || "").slice(0, 4000),
      text: String(body.text || "").slice(0, 4000),
      writingMode: String(body.writingMode || "").slice(0, 80),
      tone: String(body.tone || "").slice(0, 80),
      mood: String(body.mood || "").slice(0, 200),
      message: String(body.message || "").slice(0, 4000),
      context: compactContext(body.context),
      learnedContext: learnedMemories,
      outcomeRankings: learnedStrategies,
      learningProfile: profile ? {
        version: Number(profile.version || 1),
        style: String(profile.preferred_response_style || "").slice(0, 300),
        strategy: String(profile.strategy_summary || "").slice(0, 500),
      } : null,
    };

    if (!apiKey) {
      if (mode === "text") return Response.json({ result: safe.text, suggestions: [], provider: "local-fallback", configured: false, learning: { memoryCount: learnedMemories.length } });
      if (mode === "motivation") return Response.json({ message: "Lock in on the next controllable step. Keep the pace sustainable, protect your energy, and stack one good decision at a time.", provider: "local-fallback", configured: false, learning: { memoryCount: learnedMemories.length } });
      if (mode === "support") return Response.json({ reply: "External AI is in credit-preservation mode right now. I can still help with core app navigation and known workflows; try a specific feature or troubleshooting question.", provider: "local-fallback", configured: false, learning: { memoryCount: learnedMemories.length } });
      const earnings = Number(safe.context?.todayEarnings || 0);
      const goal = Number(safe.context?.dailyGoal || 0);
      const remaining = goal > 0 ? Math.max(0, goal - earnings) : 0;
      const reply = /how much|made|earn/i.test(safe.command)
        ? `You have $${earnings.toFixed(2)} logged today${goal ? `, with $${remaining.toFixed(2)} left toward your $${goal.toFixed(0)} goal` : ""}.`
        : "LOKIN is in credit-preservation mode. Core navigation, routing, commerce, and safety systems remain available; richer generative replies will activate when an external AI provider key is configured.";
      return Response.json({ reply, draftedMessage: "", provider: "local-fallback", configured: false, learning: { memoryCount: learnedMemories.length } });
    }

    const prompt = `${systemFor(mode)}\nRequired JSON shape: ${schemaFor(mode)}\nInput: ${JSON.stringify(safe)}`;
    const r = await jsonRequest({
      url: OPENAI_URL,
      method: "POST",
      timeoutMs: 20000,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { model, input: prompt },
    });
    if (!r.ok) return Response.json({ error: "External AI provider request failed", provider_status: r.status, request_id: r.requestId }, { status: 502 });

    const text = extractText(r.data).trim();
    let parsed;
    try { parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
    catch { parsed = mode === "motivation" ? { message: text } : mode === "text" ? { result: text, suggestions: [] } : { reply: text, draftedMessage: "" }; }

    try {
      await base44.asServiceRole.entities.LokinLearningEvent.create({
        user_id: user.id,
        event_type: "interaction",
        feature: mode,
        input_text: String(safe.command || safe.text || safe.message || "").slice(0, 4000),
        response_text: String(parsed.reply || parsed.result || parsed.message || "").slice(0, 4000),
        rating: 0,
        metadata_json: JSON.stringify({ provider: "openai", model, memory_count: learnedMemories.length }),
        occurred_at: new Date().toISOString(),
      });
      if (profile) {
        await base44.asServiceRole.entities.LokinLearningProfile.update(profile.id, {
          total_events: Number(profile.total_events || 0) + 1,
        });
      }
    } catch (e) {
      console.warn("learning event write unavailable", e?.message || e);
    }

    return Response.json({ ...parsed, provider: "external", model, learning: { enabled: profile?.learning_enabled !== false, memoryCount: learnedMemories.length, strategyCount: learnedStrategies.length, profileVersion: Number(profile?.version || 1), engineVersion: 2 } });
  } catch (e) {
    console.error("external-ai-gateway", e);
    return Response.json({ error: "External AI gateway unavailable" }, { status: 500 });
  }
}
