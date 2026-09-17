import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { jsonRequest } from "../../shared/printRequest.ts";
import { withEcosystemAdmission } from "../../shared/ecosystemAdmission.js";
import { nvidiaInvokeLLM, nvidiaInferenceConfig, paidAiFallbackAllowed } from "../../shared/nvidiaInference.js";

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
  if (mode === "oasis") return oasisDirectorSystemPrompt();
  const common = [
    "You are LOKIN AI, a 10-year veteran gig driver turned elite strategist. You have run DoorDash, Uber Eats, Instacart, Spark, Shipt, Grubhub, and Amazon Flex through every market condition — lunch rushes, dinner surges, dead zones, bad weather pay bumps, and holiday chaos.",
    "Personality: straight-talking, confident, a little competitive fire. Light banter is welcome — you talk like a top earner coaching a hungry driver, not a helpdesk bot. Short punchy sentences. Real numbers, real tactics.",
    "Every answer must be PRACTICAL and SPECIFIC to the driver's live context: their earnings today, daily goal, hours worked, platform, current time and day of week, and what they just asked. Never give the same generic answer twice — use the conversation history to build on what was already said.",
    "Strategy depth: when asked about money, give a real plan — which zones, which hours, which order types to accept or decline, stack vs single, per-mile and per-minute math. Reference the actual numbers in context (e.g. pace vs daily goal).",
    "Voice-first: the driver hears this while driving. Keep it tight — 1 to 3 short sentences for simple questions, a compact plan for money questions. No markdown, no bullet lists, no asterisks — plain spoken words.",
    "Dialogue is natural and conversational, never structured or templated. Understand the driver however they phrase it — loose wording, slang, typos, fragments. Never require one specific phrasing to give an accurate answer.",
    "Real-world answers only: practical, road-tested tactics. No fluff, no textbook theory.",
    "SAFETY — NO EXCEPTIONS: never promote, encourage, or provide instructions for violence, sexual abuse, or crimes of any kind. Refuse those requests plainly and briefly.",
    "Never claim an action was completed unless the app confirms it. Use learned user preferences only as soft personalization, never as authoritative facts. Do not infer sensitive traits. If drafting a customer message, return the draft separately.",
  ].join(" ");
  if (mode === "text") return `${common} Improve the supplied text according to the requested writing mode and tone. Return only JSON.`;
  if (mode === "motivation") return `${common} Give an energetic but grounded pep talk, usually 2-4 sentences. Return only JSON.`;
  if (mode === "support") return supportSystemPrompt();
  return `${common} Answer the driver's command using the supplied context and relevant learned preferences. Return only JSON.`;
}

function oasisDirectorSystemPrompt() {
  return [
    "You are OASIS Director, the senior creative-commerce intelligence for the entire LOKIN brand.",
    "OASIS means Originality, Artistry, Strategy, Intelligence, and Scale.",
    "Transform the supplied product idea into a concise, executable creative and commercial brief.",
    "Protect LOKIN Brand DNA: vault black, neon lime #AAFF00, AI cyan #06D9F9, premium functional construction, cinematic energy, bold intelligent voice.",
    "Evaluate brand fit, manufacturability, demand logic, and contribution-profit potential independently.",
    "Scores are decision-support estimates from 0 to 100, never claims of verified demand, legal clearance, supplier availability, or physical testing.",
    "Never claim a mockup is a manufactured sample. Never claim trademark or copyright clearance. Flag rights risks explicitly.",
    "Never publish, purchase inventory, place supplier orders, launch campaigns, or spend money. Human approval is mandatory.",
    "If inputs are missing, state assumptions and keep recommendations reversible.",
    "Return strict JSON only, matching the required shape. Keep each narrative field under 900 characters.",
  ].join("\n");
}

// LOKIN Adaptive Support — empathetic, de-escalating AI help for BOTH customers
// (marketplace buyers: LOKIN Green cannabis orders, LOKIN Brand apparel/gear) and
// drivers/truckers/travelers (gig-economy operators). It reads the person's emotional
// state, matches their tone, calms irate users, and treats every individual as unique.
function supportSystemPrompt() {
  return [
    "You are LOKIN Adaptive Support, the in-app AI help specialist for LOKIN AI.",
    "Talk naturally — not structured, not templated. Understand loose phrasing, slang, typos.",
    "Give real-world, practical answers only. No fluff, no textbook theory.",
    "SAFETY — NO EXCEPTIONS: never promote, encourage, or provide instructions for violence, sexual abuse, or crimes of any kind.",
    "You serve TWO audiences and must adapt instantly to whichever you are speaking with:",
    "  1. DRIVERS / TRUCKERS / TRAVELERS — gig-economy operators using LOKIN to earn, route, and stay safe.",
    "  2. CUSTOMERS — marketplace buyers placing orders on LOKIN Green (cannabis, 21+, discreet delivery) and LOKIN Brand (apparel & gear).",
    "",
    "CORE PRINCIPLES — treat each person as a unique individual, never a ticket number:",
    "- READ THE ROOM: detect the person's emotional state from their words (frustrated, anxious, angry, confused, disappointed, rushed, calm). Match your energy to theirs — calmer and slower when they are upset, brisker when they just want a quick answer.",
    "- EVERY PERSON IS DIFFERENT: never use a one-size template. Vary your phrasing, pace, and depth to fit THIS person's tone, situation, and technical comfort.",
    "- LEAD WITH EMPATHY: name the feeling before the fix. \"That's genuinely frustrating — especially when you're mid-shift\" lands better than jumping to steps.",
    "- DE-ESCALATE (LEAPS): Listen → Empathize → Apologize sincerely (when LOKIN is at fault) → Problem-solve → Summarize. For an irate person, slow down, lower the emotional temperature first, never argue or get defensive, never tell them to calm down.",
    "- OWN IT: when something broke on LOKIN's side, say so plainly and apologize. Never blame the user.",
    "- QUICK + ACCURATE: give the fastest correct path. Lead with the answer, then the steps. Skip filler. 1-4 sentences usually; longer only if the situation genuinely needs it.",
    "- DO NOT INVENT: never fabricate account state, order status, refunds, or policy. Never claim an action completed unless the app confirms it. If you don't know, say so and give the next best step.",
    "- NO ACCOUNT ACTIONS: you cannot change data, process refunds, reset passwords, or cancel orders yourself — guide the person to the right screen or offer human handoff.",
    "",
    "DRIVER-FACING FEATURES you can guide users to:",
    "- Home / Command Center: earnings, goal dial, Lock In Score, start work / tap out.",
    "- AI Route Optimizer (/route): sequences deliveries by mode (fastest, most profit, most money, goal mode, low stress, minimum mileage, homeward).",
    "- Work Filters (/categories), Avoid List (/avoid), Shopping AI (/locator), Gas (/fuel),",
    "- Driving Mode (/drive), Earnings (/earnings), Settings (/settings), LOKIN AI voice (/lokin).",
    "- Merchant Pickups (/driver-dispatch), Green Delivery (/green-delivery, certified drivers only),",
    "- LOKIN Cover (/insurance), LOKIN Certified (/certified), Safety (/safety), Tax (/tax).",
    "",
    "CUSTOMER-FACING FEATURES you can guide users to:",
    "- LOKIN Green (/stash): discreet cannabis ordering, 21+ age gate, category browse, cart & checkout.",
    "- LOKIN Brand (/brand): apparel & work gear store.",
    "- Order tracking: once paid, orders are dispatched to certified drivers; status updates appear in-app.",
    "- Age verification is required for all Green orders; delivery is contactless and discreet by default.",
    "",
    "TONE GUIDE — choose per person, not per script:",
    "- Irate/angry: slower, calm, validate first, shorter sentences, no exclamation marks, sincere apology if warranted, then the fix.",
    "- Anxious/worried: reassuring, concrete, remove ambiguity, \"here's exactly what will happen next.\"",
    "- Confused: patient, one step at a time, plain words, offer to walk through it together.",
    "- Rushed: answer first in one line, details only if asked.",
    "- Calm/friendly: warm, efficient, match their ease.",
    "",
    "Output strictly as JSON: { \"reply\": string }. The reply is the only text the person sees — make it land.",
  ].join("\n");
}

function schemaFor(mode) {
  if (mode === "text") return '{"result":"string","suggestions":["string"]}';
  if (mode === "motivation") return '{"message":"string"}';
  if (mode === "support") return '{"reply":"string"}';
  if (mode === "oasis") return '{"analysis_status":"completed","director_summary":"string","design_direction":"string","production_plan":"string","demand_thesis":"string","risk_review":"string","brand_score":0,"production_score":0,"demand_score":0,"profit_score":0,"recommended_price":0,"estimated_unit_cost":0,"estimated_contribution_profit":0,"next_action":"string","assumptions":["string"]}';
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

const MODEL_PRICING = Object.freeze({
  "gpt-5.6": { input: 5, output: 30 },
  "gpt-5.6-sol": { input: 5, output: 30 },
  "gpt-5.6-terra": { input: 2.5, output: 15 },
  "gpt-5.6-luna": { input: 1, output: 6 },
});

function estimateCost(usage, cfg, model) {
  const input = Number(usage?.input_tokens || 0);
  const output = Number(usage?.output_tokens || 0);
  const price = MODEL_PRICING[model] || null;
  const inputRate = price?.input ?? Number(cfg?.input_rate_per_million || 0);
  const outputRate = price?.output ?? Number(cfg?.output_rate_per_million || 0);
  return Math.max(0, (input / 1_000_000) * inputRate + (output / 1_000_000) * outputRate);
}

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = ["assistant", "text", "motivation", "support", "oasis"].includes(body.mode) ? body.mode : "assistant";
    const nvidia = nvidiaInferenceConfig();
    const apiKey = paidAiFallbackAllowed() ? secrets.get("OPENAI_API_KEY") : "";
    const defaultModel = secrets.get("OPENAI_MODEL") || "gpt-5.6";
    const lowCostModel = secrets.get("OPENAI_LOW_COST_MODEL") || "";
    let model = defaultModel;
    let guardianMode = "normal";
    let guardianConfig = null;

    try {
      const configs = await base44.asServiceRole.entities.OpenAIGuardianConfig.filter({ user_id: user.id }, "-updated_date", 1);
      guardianConfig = configs?.[0] || null;
      if (guardianConfig?.enabled !== false && Number(guardianConfig?.monthly_budget_usd || 0) > 0) {
        const events = await base44.asServiceRole.entities.OpenAIUsageEvent.filter({ user_id: user.id, occurred_at: { $gte: monthStart() } }, "-occurred_at", 500);
        const spent = (events || []).reduce((sum, e) => sum + Number(e.estimated_cost_usd || 0), 0);
        const pct = (spent / Number(guardianConfig.monthly_budget_usd)) * 100;
        const warnAt = Number(guardianConfig.warning_percent || 70);
        const preserveAt = Number(guardianConfig.preservation_percent || 90);
        if (pct >= 100 && guardianConfig.block_when_over_budget === true) guardianMode = "block";
        else if (pct >= preserveAt) guardianMode = "preserve";
        else if (pct >= warnAt) guardianMode = "warn";
        if (guardianMode === "preserve" && lowCostModel) model = lowCostModel;
      }
    } catch (e) {
      console.warn("guardian preflight unavailable", e?.message || e);
    }

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

    if (guardianMode === "block" && !nvidia.configured) {
      return Response.json({
        error: "OpenAI monthly budget cap reached",
        provider: "guardian",
        configured: Boolean(apiKey),
        guardian: { mode: guardianMode, blocked: true, api_key_exposed: false },
      }, { status: 429 });
    }

    if (!apiKey && !nvidia.configured) {
      if (mode === "text") return Response.json({ result: safe.text, suggestions: [], provider: "local-fallback", configured: false, learning: { memoryCount: learnedMemories.length } });
      if (mode === "motivation") return Response.json({ message: "Lock in on the next controllable step. Keep the pace sustainable, protect your energy, and stack one good decision at a time.", provider: "local-fallback", configured: false, learning: { memoryCount: learnedMemories.length } });
      if (mode === "support") return Response.json({ reply: "External AI is in credit-preservation mode right now. I can still help with core app navigation and known workflows; try a specific feature or troubleshooting question.", provider: "local-fallback", configured: false, learning: { memoryCount: learnedMemories.length } });
      if (mode === "oasis") return Response.json({ analysis_status: "setup_required", director_summary: "OASIS Director requires the protected external AI provider to generate a new analysis. Your saved project remains intact.", provider: "local-fallback", configured: false, guardian: { mode: guardianMode, api_key_exposed: false } });
      const earnings = Number(safe.context?.todayEarnings || 0);
      const goal = Number(safe.context?.dailyGoal || 0);
      const remaining = goal > 0 ? Math.max(0, goal - earnings) : 0;
      const reply = /how much|made|earn/i.test(safe.command)
        ? `You have $${earnings.toFixed(2)} logged today${goal ? `, with $${remaining.toFixed(2)} left toward your $${goal.toFixed(0)} goal` : ""}.`
        : "LOKIN is in credit-preservation mode. Core navigation, routing, commerce, and safety systems remain available; richer generative replies will activate when an external AI provider key is configured.";
      return Response.json({ reply, draftedMessage: "", provider: "local-fallback", configured: false, learning: { memoryCount: learnedMemories.length } });
    }

    const prompt = `${systemFor(mode)}\nRequired JSON shape: ${schemaFor(mode)}\nInput: ${JSON.stringify(safe)}`;

    if (nvidia.configured) {
      try {
        const local = await withEcosystemAdmission(base44, {
          sourceApp:"LOKIN AI", domain:"ai", type:"owned_ai_inference", operation:`nvidia_${mode}`,
          provider:"nvidia_owned_inference", priority:mode === "support" ? 80 : 55, estimatedMs:20000,
          estimatedCost:0, realtime:mode === "support", tags:["owned-gpu","ai",mode],
        }, () => nvidiaInvokeLLM({ prompt }, { sourceApp:"LOKIN AI", domain:"ai", mode }));
        const parsed = typeof local === "string"
          ? (mode === "motivation" ? { message:local } : mode === "text" ? { result:local, suggestions:[] } : mode === "oasis" ? { analysis_status:"unparsed", director_summary:local } : { reply:local, draftedMessage:"" })
          : (local || {});
        try {
          await base44.asServiceRole.entities.LokinLearningEvent.create({
            user_id:user.id, event_type:"interaction", feature:mode,
            input_text:String(safe.command || safe.text || safe.message || "").slice(0,4000),
            response_text:String(parsed.reply || parsed.result || parsed.message || parsed.director_summary || "").slice(0,4000),
            rating:0,
            metadata_json:JSON.stringify({ provider:"nvidia_owned_inference", model:nvidia.llmModel, memory_count:learnedMemories.length }),
            occurred_at:new Date().toISOString(),
          });
          if (profile) await base44.asServiceRole.entities.LokinLearningProfile.update(profile.id, { total_events:Number(profile.total_events || 0) + 1 });
        } catch (e) { console.warn("local learning telemetry unavailable", e?.message || e); }
        return Response.json({
          ...parsed,
          provider:"nvidia-owned",
          model:nvidia.llmModel,
          usage:{ input_tokens:0, output_tokens:0, total_tokens:0, estimated_cost_usd:0 },
          guardian:{ mode:"owned-compute", api_key_exposed:false, paid_fallback_enabled:paidAiFallbackAllowed() },
          learning:{ enabled:profile?.learning_enabled !== false, memoryCount:learnedMemories.length, strategyCount:learnedStrategies.length, profileVersion:Number(profile?.version || 1), engineVersion:2 }
        });
      } catch (e) {
        console.warn("NVIDIA owned inference unavailable", e?.message || e);
        if (!apiKey) throw e;
      }
    }

    const price = MODEL_PRICING[model] || {};
    const estimatedInputTokens = Math.max(1, Math.ceil(prompt.length / 4));
    const estimatedCostUsd = Math.max(0.001,
      (estimatedInputTokens / 1_000_000) * Number(price.input || guardianConfig?.input_rate_per_million || 0)
      + (1000 / 1_000_000) * Number(price.output || guardianConfig?.output_rate_per_million || 0));
    const r = await withEcosystemAdmission(base44, {
      sourceApp:"LOKIN AI", domain:"ai", type:"external_ai_inference", operation:`openai_${mode}`,
      provider:"openai", priority:mode === "support" ? 80 : 55, estimatedMs:20000,
      estimatedCost:estimatedCostUsd, realtime:mode === "support",
      tags:["credits","ai", mode],
    }, () => jsonRequest({
      url: OPENAI_URL,
      method: "POST",
      timeoutMs: 20000,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { model, input: prompt },
    }));
    if (!r.ok) {
      try {
        await base44.asServiceRole.entities.OpenAIUsageEvent.create({
          user_id: user.id,
          request_id: String(r.requestId || ""),
          model,
          mode,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          estimated_cost_usd: 0,
          status: "provider_error",
          occurred_at: new Date().toISOString(),
        });
      } catch {}
      return Response.json({ error: "External AI provider request failed", provider_status: r.status, request_id: r.requestId, guardian: { mode: guardianMode, api_key_exposed: false } }, { status: 502 });
    }

    const usage = r.data?.usage || {};
    const estimatedCost = estimateCost(usage, guardianConfig, model);
    try {
      await base44.asServiceRole.entities.OpenAIUsageEvent.create({
        user_id: user.id,
        request_id: String(r.requestId || r.data?.id || ""),
        model,
        mode,
        input_tokens: Number(usage.input_tokens || 0),
        output_tokens: Number(usage.output_tokens || 0),
        total_tokens: Number(usage.total_tokens || (Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0))),
        estimated_cost_usd: estimatedCost,
        status: "success",
        occurred_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("usage telemetry write unavailable", e?.message || e);
    }

    const text = extractText(r.data).trim();
    let parsed;
    try { parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
    catch { parsed = mode === "motivation" ? { message: text } : mode === "text" ? { result: text, suggestions: [] } : mode === "oasis" ? { analysis_status: "unparsed", director_summary: text, brand_score: 0, production_score: 0, demand_score: 0, profit_score: 0 } : { reply: text, draftedMessage: "" }; }

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

    return Response.json({
      ...parsed,
      provider: "external",
      model,
      usage: {
        input_tokens: Number(usage.input_tokens || 0),
        output_tokens: Number(usage.output_tokens || 0),
        total_tokens: Number(usage.total_tokens || 0),
        estimated_cost_usd: Number(estimatedCost.toFixed(6)),
      },
      guardian: { mode: guardianMode, api_key_exposed: false, low_cost_model_active: model !== defaultModel },
      learning: { enabled: profile?.learning_enabled !== false, memoryCount: learnedMemories.length, strategyCount: learnedStrategies.length, profileVersion: Number(profile?.version || 1), engineVersion: 2 }
    });
  } catch (e) {
    console.error("external-ai-gateway", e);
    return Response.json({ error: "External AI gateway unavailable" }, { status: 500 });
  }
}