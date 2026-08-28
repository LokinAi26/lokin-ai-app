import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch {}
    const location = (body.location || "").trim() || "United States";

    const res = await invokeLLMWithAdmission(base44, {
      prompt: `Return current real-time data for a live info ticker. (1) WEATHER: current conditions for ${location} — temperature in Fahrenheit (whole number) and a one-word condition. (2) SPORTS: today's 4 most notable real sports results or in-progress games (NBA, NFL, MLB, NHL, MLS, or major soccer — whichever are active), each as a short string like "Lakers 112 - Warriors 108 (Final)". (3) STOCKS: current real prices and percent change for AAPL, TSLA, AMZN, GOOGL, NVDA. Use the latest available real data.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          weather: {
            type: "object",
            properties: {
              location: { type: "string" },
              temp_f: { type: "number" },
              condition: { type: "string" }
            }
          },
          sports: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" } }
            }
          },
          stocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                symbol: { type: "string" },
                price: { type: "number" },
                change_percent: { type: "number" }
              }
            }
          }
        }
      }
    });
    return Response.json(res);
  } catch (error) {
    console.error("getTicker error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}