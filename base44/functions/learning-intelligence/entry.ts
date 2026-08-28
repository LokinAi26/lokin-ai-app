import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { recordMeasuredOutcome } from "../../shared/outcomeLearning.js";
import { putControlState } from "../../shared/unifiedControlPlane.js";

const now = () => new Date().toISOString();
const clean = (value, max = 2000) => String(value || "").trim().slice(0, max);
const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function confidenceFor(positive:number, negative:number, evidence:number) {
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
    const strategiesApi = base44.asServiceRole.entities.LokinStrategyPerformance;

    let profiles = await profilesApi.filter({ user_id: userId }, "-updated_date", 1);
    let profile = profiles?.[0] || null;
    if (!profile) profile = await profilesApi.create({ user_id:userId, version:1, learning_enabled:true, preferred_response_style:"concise, practical, driver-safe", strategy_summary:"Learn only from this user's interactions, feedback, corrections, and measured outcomes.", confidence:0.5, total_events:0, last_learned_at:now() });

    if (action === "context") {
      const [memories, strategies, controlMemories] = await Promise.all([
        memoriesApi.filter({ user_id:userId, active:true }, "-updated_date", 50),
        strategiesApi.filter({ user_id:userId, active:true }, "-rank_score", 10),
        base44.asServiceRole.entities.LokinControlState.filter({ owner_user_id:userId, namespace:"lokin.ai", state_type:"MEMORY", status:"ACTIVE" }, "-updated_date", 50).catch(() => []),
      ]);
      const queryTerms = clean(body.query_text, 1000).toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2);
      const scored = memories.map((memory:any) => {
        const haystack = `${memory.topic || ""} ${memory.summary || ""}`.toLowerCase();
        const lexical = queryTerms.length ? queryTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0) / queryTerms.length : 0;
        const confidence = Math.max(0, Math.min(1, n(memory.confidence, 0.5)));
        const evidence = Math.min(1, n(memory.evidence_count, 1) / 8);
        const ageDays = Math.max(0, (Date.now() - Date.parse(memory.updated_date || memory.last_evidence_at || now())) / 86400000);
        const recency = 1 / (1 + ageDays / 30);
        return { memory, score: lexical * 0.55 + confidence * 0.25 + evidence * 0.10 + recency * 0.10 };
      }).sort((a:any,b:any) => b.score - a.score).slice(0, 20);
      return Response.json({ profile, memories:scored.map((x:any) => x.memory), memory_scores:scored.map((x:any) => ({ id:x.memory.id, score:Number(x.score.toFixed(4)) })), strategies, control_memories:controlMemories.slice(0,20), learning_enabled: profile.learning_enabled !== false, engine_version: 4 });
    }

    if (action === "feedback") {
      const rating = n(body.rating) >= 0 ? 1 : -1;
      const feature = clean(body.feature, 120) || "assistant";
      const inputText = clean(body.input_text, 4000);
      const responseText = clean(body.response_text, 4000);
      const topic = clean(body.topic, 160) || `response:${feature}`;
      const occurredAt = now();
      await eventsApi.create({ user_id:userId, event_type:"feedback", feature, input_text:inputText, response_text:responseText, rating, metadata_json:JSON.stringify({ source:"assistant-feedback", engine_version:3 }), occurred_at:occurredAt });
      const existing = await memoriesApi.filter({ user_id:userId, topic, active:true }, "-updated_date", 1);
      const memory = existing?.[0];
      const positive = n(memory?.positive_count) + (rating > 0 ? 1 : 0);
      const negative = n(memory?.negative_count) + (rating < 0 ? 1 : 0);
      const evidence = n(memory?.evidence_count) + 1;
      const record = { user_id:userId, memory_type:rating > 0 ? "strategy" : "correction", topic, summary: rating > 0 ? `The user found this ${feature} response approach helpful. Prefer similar clarity and decision support when relevant.` : `The user found this ${feature} response approach unhelpful. Avoid repeating the same approach and favor alternatives supported by future outcomes.`, confidence:confidenceFor(positive, negative, evidence), evidence_count:evidence, positive_count:positive, negative_count:negative, last_evidence_at:occurredAt, source:"feedback", active:true };
      const saved = memory ? await memoriesApi.update(memory.id, record) : await memoriesApi.create(record);
      await putControlState(base44, {
        canonical_key:`memory:${topic}`,
        namespace:"lokin.ai",
        scope:"USER",
        scope_id:userId,
        state_type:"MEMORY",
        source_app:"LOKIN AI",
        owner_user_id:userId,
        resource_type:"LokinLearningMemory",
        resource_id:saved.id,
        content:{ memory_id:saved.id, memory_type:record.memory_type, topic, summary:record.summary, confidence:record.confidence, evidence_count:evidence },
        confidence:record.confidence,
        evidence_count:evidence,
        provenance:{ learning_engine_version:4, source:"feedback" },
      }, { userId, role:user.role }).catch(() => null);
      profile = await profilesApi.update(profile.id, { total_events:n(profile.total_events)+1, last_learned_at:occurredAt, version:n(profile.version,1)+1 });
      return Response.json({ ok:true, learned:true, memory:saved, profile, engine_version:4 });
    }

    if (action === "outcome") {
      const strategyKey = clean(body.strategy_key, 180);
      if (!strategyKey) return Response.json({ error:"strategy_key required" }, { status:400 });
      const prefs = await base44.entities.DriverPreference.filter({});
      const result = await recordMeasuredOutcome(base44, userId, { ...body, strategy_key: strategyKey }, {
        profile,
        preferences: prefs?.[0] || {},
      });
      if (result?.strategy) await putControlState(base44, {
        canonical_key:`memory:outcome:${strategyKey}`,
        namespace:"lokin.ai",
        scope:"USER",
        scope_id:userId,
        state_type:"MEMORY",
        source_app:"LOKIN AI",
        owner_user_id:userId,
        resource_type:"LokinStrategyPerformance",
        resource_id:result.strategy.id,
        content:{ strategy_key:strategyKey, summary:result.strategy.summary, rank_score:result.strategy.rank_score, confidence:result.strategy.confidence, sample_count:result.strategy.sample_count },
        confidence:n(result.strategy.confidence,0.5),
        evidence_count:n(result.strategy.sample_count,1),
        provenance:{ learning_engine_version:4, source:"measured_outcome" },
      }, { userId, role:user.role }).catch(() => null);
      return Response.json({ ...result, engine_version:4 });
    }

    if (action === "rank-strategies") {
      const strategies = await strategiesApi.filter({ user_id:userId, active:true }, "-rank_score", Math.min(20, Math.max(1, n(body.limit,10))));
      return Response.json({ strategies, engine_version:3 });
    }

    if (action === "remember") {
      const memoryType = ["preference","pattern","strategy","correction","goal","context"].includes(body.memory_type) ? body.memory_type : "context";
      const topic = clean(body.topic,160); const summary = clean(body.summary,1500);
      if (!topic || !summary) return Response.json({ error:"topic and summary required" }, { status:400 });
      const existing = await memoriesApi.filter({ user_id:userId, topic, active:true }, "-updated_date", 1);
      const current = existing?.[0]; const evidence = n(current?.evidence_count)+1;
      const record = { user_id:userId, memory_type:memoryType, topic, summary, confidence:Math.min(0.98,n(body.confidence,current?.confidence||0.65)+Math.min(0.2,evidence*0.02)), evidence_count:evidence, positive_count:n(current?.positive_count), negative_count:n(current?.negative_count), last_evidence_at:now(), source:body.source === "explicit" ? "explicit" : "interaction", active:true };
      const saved = current ? await memoriesApi.update(current.id,record) : await memoriesApi.create(record);
      await putControlState(base44, {
        canonical_key:`memory:${topic}`,
        namespace:"lokin.ai",
        scope:"USER",
        scope_id:userId,
        state_type:"MEMORY",
        source_app:"LOKIN AI",
        owner_user_id:userId,
        resource_type:"LokinLearningMemory",
        resource_id:saved.id,
        content:{ memory_id:saved.id, memory_type:memoryType, topic, summary, confidence:record.confidence, evidence_count:evidence },
        confidence:record.confidence,
        evidence_count:evidence,
        immutable:body.lock === true,
        lock_mode:body.lock === true ? "APPROVED" : "NONE",
        provenance:{ learning_engine_version:4, source:record.source },
      }, { userId, role:user.role }).catch(() => null);
      profile = await profilesApi.update(profile.id,{ last_learned_at:now(), version:n(profile.version,1)+1 });
      return Response.json({ ok:true, memory:saved, profile, engine_version:4 });
    }

    if (action === "set-enabled") {
      const enabled = body.enabled !== false;
      profile = await profilesApi.update(profile.id,{ learning_enabled:enabled,last_learned_at:now() });
      return Response.json({ ok:true,learning_enabled:enabled,profile,engine_version:3 });
    }
    return Response.json({ error:"Unknown action" }, { status:400 });
  } catch (error) {
    console.error("learning-intelligence", error);
    return Response.json({ error:"Learning intelligence unavailable" }, { status:500 });
  }
}