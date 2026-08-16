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
  const common = "You are LOKIN AI, a concise, practical copilot for gig drivers. Be accurate, useful, and brief. Never claim an action was completed unless the app confirms it. If drafting a customer message, return the draft separately.";
  if (mode === "text") return `${common} Improve the supplied text according to the requested writing mode and tone. Return only JSON.`;
  if (mode === "motivation") return `${common} Give an energetic but grounded pep talk, usually 2-4 sentences. Return only JSON.`;
  if (mode === "support") return `${common} Help troubleshoot the user's LOKIN issue. Prefer concrete steps and avoid inventing account state. Return only JSON.`;
  return `${common} Answer the driver's command using the supplied context. Return only JSON.`;
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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = ["assistant", "text", "motivation", "support"].includes(body.mode) ? body.mode : "assistant";
    // Prefer the canonical secret name, but keep the legacy OPENAI secret as a safe fallback
    // during credential migration so existing deployments do not drop into local fallback.
    const apiKey = secrets.get("OPENAI_API_KEY") || secrets.get("OPENAI");
    const model = secrets.get("OPENAI_MODEL") || "gpt-5.6";

    const safe = {
      command: String(body.command || "").slice(0, 4000),
      text: String(body.text || "").slice(0, 4000),
      writingMode: String(body.writingMode || "").slice(0, 80),
      tone: String(body.tone || "").slice(0, 80),
      mood: String(body.mood || "").slice(0, 200),
      message: String(body.message || "").slice(0, 4000),
      context: compactContext(body.context),
    };

    if (!apiKey) {
      if (mode === "text") return Response.json({ result: safe.text, suggestions: [], provider: "local-fallback", configured: false });
      if (mode === "motivation") return Response.json({ message: "Lock in on the next controllable step. Keep the pace sustainable, protect your energy, and stack one good decision at a time.", provider: "local-fallback", configured: false });
      if (mode === "support") return Response.json({ reply: "External AI is in credit-preservation mode right now. I can still help with core app navigation and known workflows; try a specific feature or troubleshooting question.", provider: "local-fallback", configured: false });
      const earnings = Number(safe.context?.todayEarnings || 0);
      const goal = Number(safe.context?.dailyGoal || 0);
      const remaining = goal > 0 ? Math.max(0, goal - earnings) : 0;
      const reply = /how much|made|earn/i.test(safe.command)
        ? `You have $${earnings.toFixed(2)} logged today${goal ? `, with $${remaining.toFixed(2)} left toward your $${goal.toFixed(0)} goal` : ""}.`
        : "LOKIN is in credit-preservation mode. Core navigation, routing, commerce, and safety systems remain available; richer generative replies will activate when an external AI provider key is configured.";
      return Response.json({ reply, draftedMessage: "", provider: "local-fallback", configured: false });
    }

    const prompt = `${systemFor(mode)}\nRequired JSON shape: ${schemaFor(mode)}\nInput: ${JSON.stringify(safe)}`;
    const r = await jsonRequest({
      url: OPENAI_URL,
      method: "POST",
      timeoutMs: 20000,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { model, input: prompt, store: false, max_output_tokens: 900 },
    });
    if (!r.ok) return Response.json({ error: "External AI provider request failed", provider_status: r.status, request_id: r.requestId }, { status: 502 });

    const text = extractText(r.data).trim();
    let parsed;
    try { parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
    catch { parsed = mode === "motivation" ? { message: text } : mode === "text" ? { result: text, suggestions: [] } : { reply: text, draftedMessage: "" }; }

    return Response.json({ ...parsed, provider: "external", model });
  } catch (e) {
    console.error("external-ai-gateway", e);
    return Response.json({ error: "External AI gateway unavailable" }, { status: 500 });
  }
}
