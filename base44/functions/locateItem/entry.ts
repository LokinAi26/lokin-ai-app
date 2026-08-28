import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// AI item locator: given a barcode, item code, or product name, find the best
// matching verified locator record. This function never fabricates physical
// proximity; indoor distance requires a real beacon/UWB/store-position feed.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const query = String(body.query || "").trim();
    const store = body.store ? String(body.store) : null;
    if (!query) return Response.json({ error: "query required" }, { status: 400 });

    const allItems = await base44.entities.LocatorItem.filter({});
    const items = store
      ? allItems.filter((i) => !i.store || String(i.store).toLowerCase() === String(store).toLowerCase())
      : allItems;

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
      const res = await invokeLLMWithAdmission(base44, {
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
        department: match.department,
        inventory_count: match.inventory_count ?? 0,
        inventory_status: match.inventory_status || "unknown",
        inventory_source: match.inventory_source || "store_feed",
        last_inventory_update: match.last_inventory_update,
        map_x: match.map_x,
        map_y: match.map_y,
        map_zone: match.map_zone,
      },
      proximity_available: false,
      proximity_source: null,
      confidence: fuzzy ? fuzzy.confidence : 1,
      fuzzy,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}