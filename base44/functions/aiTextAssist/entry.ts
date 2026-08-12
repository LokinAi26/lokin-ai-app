import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// AI text assistant — Grammarly-style typing help for the LOKIN AI app.
// Input: { text: string, mode: "polish"|"rewrite"|"complete", tone?: string }
// Returns: { result: string|null, suggestions: string[]|null }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "");
    const mode = String(body.mode || "polish");
    const tone = String(body.tone || "professional");

    if (!text.trim() && mode !== "complete") {
      return Response.json({ error: "text required" }, { status: 400 });
    }

    let prompt;
    let schema;

    if (mode === "rewrite") {
      prompt = [
        `You are an AI writing assistant inside a gig-driver app. Rewrite the text in a ${tone} tone.`,
        `Keep the meaning and key details. Keep it concise and natural. Return only the rewritten text.`,
        `Text: """${text}"""`,
      ].join("\n");
      schema = {
        type: "object",
        properties: { result: { type: "string" } },
        required: ["result"],
      };
    } else if (mode === "complete") {
      prompt = [
        `You are an AI typing assistant for a gig delivery driver.`,
        `Given partial text, suggest 3 short natural continuations the driver might want to type.`,
        `Each continuation should be a full phrase (no ellipsis) under 12 words, completing the thought.`,
        `Return only the completed phrases.`,
        `Partial text: """${text}"""`,
      ].join("\n");
      schema = {
        type: "object",
        properties: { suggestions: { type: "array", items: { type: "string" } } },
        required: ["suggestions"],
      };
    } else {
      prompt = [
        `You are an AI writing assistant. Fix spelling and grammar and clean up phrasing of the text.`,
        `Keep the meaning and tone. Return only the corrected text.`,
        `Text: """${text}"""`,
      ].join("\n");
      schema = {
        type: "object",
        properties: { result: { type: "string" } },
        required: ["result"],
      };
    }

    const out = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
      model: "gpt_5_mini",
    });

    if (mode === "complete") {
      const suggestions = Array.isArray(out.suggestions)
        ? out.suggestions.slice(0, 3).map(String)
        : [];
      return Response.json({ suggestions, result: null });
    }
    return Response.json({ result: String(out.result || ""), suggestions: null });
  } catch (error) {
    console.error("aiTextAssist error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}