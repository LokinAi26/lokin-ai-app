import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import { screenshotToDataUrl } from "@/lib/earningsOcr";

// Client helper for the order-items import pipeline.
// Flow: driver snaps the Dasher/Instacart/Shipt shopping-list screen(s) ->
// image(s) downscaled locally -> external-ai-gateway (task: order_items_ocr)
// returns { parsed, ... } -> normalizeOrderItems() cleans the list ->
// driver reviews -> items merge into the locator's Smart Shop trip list.

// Ask the gateway to parse up to 2 order screenshots. Returns { parsed,
// reply, engine, model, usage } where parsed is
// { items: [{name, quantity, unit}], store, confidence, note }.
export async function parseOrderItemsScreenshots(dataUrls) {
  const list = (Array.isArray(dataUrls) ? dataUrls : [dataUrls])
    .map((d) => /^data:([^;]+);base64,(.+)$/s.exec(String(d || "")))
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => ({ mimeType: m[1], data: m[2] }));
  if (!list.length) throw new Error("Could not read those images. Try other screenshots.");
  const res = await guardedInvoke(
    base44,
    "external-ai-gateway",
    {
      task: "order_items_ocr",
      engine: "gemini",
      message: "Parse this shopping order screenshot into JSON.",
      images: list,
    },
    { userInitiated: true }
  );
  const payload = res?.data || res || {};
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

// Normalize the model's JSON into clean Smart Shop-ready items:
// [{ name, quantity, unit }]. Drops empties, clamps quantities.
export function normalizeOrderItems(parsed) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const raw = Array.isArray(p.items) ? p.items : [];
  const seen = new Set();
  const out = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const name = typeof it.name === "string" ? it.name.trim().slice(0, 120) : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;
    qty = Math.min(99, Math.round(qty));
    const unit = typeof it.unit === "string" && it.unit.trim() ? it.unit.trim().slice(0, 24) : "";
    out.push({ name, quantity: qty, unit });
  }
  return {
    items: out,
    store: typeof p.store === "string" ? p.store.trim().slice(0, 80) : "",
    confidence: p.confidence || "low",
    note: typeof p.note === "string" ? p.note.trim().slice(0, 160) : "",
  };
}

export { screenshotToDataUrl };
