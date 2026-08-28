import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// LOKIN AI voice assistant — "Hey LOKIN…"
// Input: { command: string, context: { todayEarnings, dailyGoal, netPerHour, remaining, hoursWorked, platform } }
// Returns: { reply: string, draftedMessage: string|null }
// draftedMessage is set when the command is a customer-comms request; the driver
// must confirm "SEND" before it is sent (handled client-side).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const command = String(body.command || "").trim();
    if (!command) return Response.json({ error: "command required" }, { status: 400 });
    const ctx = body.context || {};

    const remaining = Math.max(0, Number(ctx.dailyGoal || 150) - Number(ctx.todayEarnings || 0));

    const reply = await invokeLLMWithAdmission(base44, {
      prompt: [
        `You are LOKIN AI, a calm, concise voice assistant for a gig delivery driver.`,
        `Speak in short, natural sentences a driver can hear while driving — max 2 sentences unless drafting a message.`,
        `Driver context: earned $${Number(ctx.todayEarnings || 0).toFixed(2)} today, daily goal $${ctx.dailyGoal || 150},`,
        `remaining $${remaining.toFixed(2)}, current net rate $${Number(ctx.netPerHour || 0).toFixed(2)}/hr,`,
        `hours worked ${Number(ctx.hoursWorked || 0).toFixed(1)}, platform ${ctx.platform || "mixed"}.`,
        ``,
        `Driver said: "${command}"`,
        ``,
        `If this is a question (e.g. "what should I do next", "how much have I made", "am I on pace"), answer it directly and motivate.`,
        `If this is a request to tell/message a customer something (e.g. "tell them I'm 5 min away", "traffic", "waiting for the order", "I'm outside"),`,
        `set draftedMessage to a polite, professional customer message ready to send, and set reply to a one-line confirmation like`,
        `"I drafted an update. Say SEND to confirm." Do NOT claim to actually send it.`,
        ``,
        `Respond strictly as JSON: { "reply": string, "draftedMessage": string|null }.`,
      ].join("\n"),
      response_json_schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          draftedMessage: { type: ["string", "null"] },
        },
        required: ["reply", "draftedMessage"],
      },
      model: "gpt_5_mini",
    });

    return Response.json({
      reply: reply.reply || "I didn't catch that.",
      draftedMessage: reply.draftedMessage || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}