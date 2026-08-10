import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// AI item locator: given a barcode or item code (or a name), find the best matching
// locator item + return a confidence + a "distance" 0-100 used by the UI to drive
// the beep intensity. Uses InvokeLLM for fuzzy matching when exact match misses.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const query = String(body.query || "").trim();
    const store = body.store ? String(body.store) : null;
    if (!query) return Response.json({ error: "query required" }, { status: 400 });

    const items = await base44.entities.LocatorItem.filter({});

    // 1) exact barcode / item_code / name match
    let match = items.find(
      (i) =>
        (i.barcode && i.barcode === query) ||
        (i.item_code && i.item_code.toLowerCase() === query.toLowerCase()) ||
        (i.name && i.name.toLowerCase() === query.toLowerCase())
    );

    let fuzzy = null;
    if (!match) {
      // 2) fuzzy via LLM
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: [
          `A delivery driver is looking for an item in a store.`,
          `Search query: "${query}".`,
          `Known items:`,
          ...items.map((i) => `- ${i.name} | barcode:${i.barcode || "n/a"} | code:${i.item_code || "n/a"} | aisle:${i.aisle || "?"} | shelf:${i.shelf || "?"} | store:${i.store || "any"}`),
          `Return ONLY JSON: {"match_name": "<best matching item name or null>", "confidence": <0-1>, "reason": "<short>"}`,
        ].join("\n"),
        response_json_schema: {
          type: "object",
          properties: {
            match_name: { type: "string" },
            confidence: { type: "number" },
            reason: { type: "string" },
          },
        },
      });
      if (res && res.match_name) {
        fuzzy = res;
        match = items.find((i) => i.name === res.match_name);
      }
    }

    if (!match) {
      return Response.json({ found: false, query, message: "No matching item found in locator database." });
    }

    // Simulated proximity: a stable pseudo-distance derived from aisle/shelf so the
    // UI beep can intensify as the driver "approaches". Distance 0 = right there.
    const aisleScore = (parseInt(String(match.aisle).replace(/\D/g, "")) || 0) % 20;
    const shelfScore = (parseInt(String(match.shelf).replace(/\D/g, "")) || 0) % 10;
    const distance = Math.min(100, aisleScore * 5 + shelfScore * 3 + (store && match.store && match.store !== store ? 15 : 0));

    return Response.json({
      found: true,
      query,
      item: {
        id: match.id,
        name: match.name,
        barcode: match.barcode,
        item_code: match.item_code,
        aisle: match.aisle,
        shelf: match.shelf,
        store: match.store,
        price: match.price,
      },
      distance, // 0..100, lower = closer
      confidence: fuzzy ? fuzzy.confidence : 1,
      fuzzy,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}