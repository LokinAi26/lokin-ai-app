import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rateLimitResponse } from '../../shared/ipRateLimit.js';

export default async function(req) {
  try {
    // Cost-abuse guard: 20 requests per client per minute on this paid AI/geo endpoint.
    const limited = rateLimitResponse(req, 'find-mechanic', 20, 60 * 1000);
    if (limited) return limited;
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch {}
    const location = (body.location || "").trim();
    if (!location) return Response.json({ error: "Location is required" }, { status: 400 });

    const res = await invokeLLMWithAdmission(base44, {
      prompt: `Find up to 5 auto repair shops, mechanics, and roadside assistance services near "${location}". For each, provide the business name, full street address, phone number, main services offered, Google rating as a number from 0 to 5, whether they offer roadside assistance or towing as a boolean, and a Google Maps directions URL. Only include real businesses that actually exist.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                address: { type: "string" },
                phone: { type: "string" },
                services: { type: "string" },
                rating: { type: "number" },
                roadside_assistance: { type: "boolean" },
                maps_url: { type: "string" }
              }
            }
          }
        }
      }
    });
    return Response.json(res);
  } catch (error) {
    console.error("findMechanic error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}