import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch {}
    const location = (body.location || "").trim();
    const route = (body.route || "").trim();
    const category = (body.category || "all").trim();

    if (!location && !route) {
      return Response.json({ error: "Location or route is required" }, { status: 400 });
    }

    const where = route ? `along the driving route from ${route}` : `near ${location}`;

    const categoryClause =
      category === "all"
        ? "truck stops, commercial weigh stations, public rest areas, and RV parks / campgrounds"
        : category === "truck_stop"
        ? "truck stops (large commercial travel plazas with diesel and truck parking)"
        : category === "weigh_station"
        ? "commercial truck weigh stations"
        : category === "rest_area"
        ? "public highway rest areas"
        : category === "rv_park"
        ? "RV parks and campgrounds"
        : "truck stops, weigh stations, rest areas, and RV parks";

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Find up to 8 real ${categoryClause} ${where}. For each, return the business/site name, its type (one of: truck_stop, weigh_station, rest_area, rv_park), full street address, key amenities (diesel, truck parking, showers, food, dump station, etc.) as a short string, Google rating as a number from 0 to 5 (use 0 if unknown), and a Google Maps directions URL. Only include real places that actually exist.`,
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
                type: { type: "string", enum: ["truck_stop", "weigh_station", "rest_area", "rv_park"] },
                address: { type: "string" },
                amenities: { type: "string" },
                rating: { type: "number" },
                maps_url: { type: "string" }
              }
            }
          }
        }
      }
    });
    return Response.json(res);
  } catch (error) {
    console.error("findRoadStops error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}