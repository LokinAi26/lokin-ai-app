import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// LOKIN AI Customer Support Rep — in-app AI help desk.
// Input: { message: string, history: [{role:"user"|"assistant", content:string}] }
// Returns: { reply: string }
// The rep answers questions about app features, billing/subscriptions, troubleshooting,
// and navigation help. It cannot perform account actions — it guides the user to the
// right screen or hands off to a human for anything it can't resolve.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    if (!message) return Response.json({ error: "message required" }, { status: 400 });
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    const convo = history
      .map((m) => `${m.role === "user" ? "Driver" : "LOKIN Support"}: ${m.content}`)
      .join("\n");

    const result = await invokeLLMWithAdmission(base44, {
      prompt: [
        `You are LOKIN Support, the in-app AI customer service rep for LOKIN AI — a gig-economy operating system for delivery drivers.`,
        `Be warm, concise, and helpful. Answer in 1-3 short sentences. Use plain, friendly language (no jargon).`,
        `If the user is frustrated, acknowledge it calmly before helping.`,
        ``,
        `LOKIN AI app features you can guide users to:`,
        `- Command Center (Home): earnings, goal dial, Lock In Score, start work / tap out.`,
        `- AI Route Optimizer (/route): sequences deliveries by mode (fastest, most profit, most money, goal mode, low stress, minimum mileage, homeward).`,
        `- Work Filters (/categories): delivery types & blocked customers.`,
        `- Shopping AI (/locator): scan barcodes, beep-to-find items on the shelf.`,
        `- Avoid List (/avoid): stores, customers, locations to skip.`,
        `- Gas Discounts (/fuel): weekly codes & cashback logging.`,
        `- LOKIN AI Assistant (/lokin): hands-free voice assistant for commands & customer messages.`,
        `- Driving Mode (/drive): GPS radar HUD for active routes.`,
        `- Earnings (/earnings): revenue, net-after-fuel, platform breakdown, charts.`,
        `- Settings (/settings): MPG, fuel price, mileage cost, daily/weekly goals, optimization mode.`,
        `- LOKIN Brand (/brand): brand system, apparel & work gear store.`,
        `- Subscriptions: Pro unlocks advanced routing & deeper AI analytics; Elite adds priority everything.`,
        ``,
        `Rules:`,
        `- To navigate, tell the user which screen to open (e.g. "Tap More → Settings").`,
        `- For billing/subscription issues you can't resolve, say a human rep will follow up.`,
        `- Never claim to change account data, process refunds, or reset passwords — guide to the right place or offer human handoff.`,
        `- If the message is a bug report, thank them, give a workaround if you know one, and say the team has been notified.`,
        ``,
        `Conversation so far:`,
        convo,
        ``,
        `Driver now says: "${message}"`,
        ``,
        `Respond strictly as JSON: { "reply": string }.`,
      ].join("\n"),
      response_json_schema: {
        type: "object",
        properties: { reply: { type: "string" } },
        required: ["reply"],
      },
      model: "gpt_5_mini",
    });

    return Response.json({ reply: result.reply || "I'm here — could you say that again?" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}