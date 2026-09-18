import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";

// Client helper for the earnings-screenshot OCR pipeline.
// Flow: driver picks a screenshot -> image is downscaled locally ->
// external-ai-gateway (task: earnings_ocr) returns { parsed, ... } ->
// caller confirms and creates an Earning record.

const MAX_DIM = 1600;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// Downscale to a bounded JPEG data URL so the vision payload stays small.
export async function screenshotToDataUrl(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function splitDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

// Ask the gateway to parse the screenshot. Returns { parsed, reply, engine,
// model, usage } where parsed is { amount, platform, date, trips, currency,
// confidence, note } (fields may be null when the model is unsure).
export async function parseEarningsScreenshot(dataUrl) {
  const img = splitDataUrl(dataUrl);
  if (!img) throw new Error("Could not read that image. Try another screenshot.");
  const res = await guardedInvoke(
    base44,
    "external-ai-gateway",
    {
      task: "earnings_ocr",
      engine: "gemini",
      message: "Parse this gig-driver earnings screenshot into JSON.",
      images: [{ mimeType: img.mimeType, data: img.data }],
    },
    { userInitiated: true }
  );
  const payload = res?.data || res || {};
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

// Normalize the model's JSON into form-ready values.
export function normalizeParsedEarning(parsed) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const amount = Number(p.amount);
  const trips = Number(p.trips);
  let date = "";
  if (typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) date = p.date;
  return {
    amount: Number.isFinite(amount) && amount > 0 ? String(Math.round(amount * 100) / 100) : "",
    platform: typeof p.platform === "string" ? p.platform : "",
    date,
    trips: Number.isFinite(trips) && trips > 0 ? String(Math.round(trips)) : "",
    confidence: p.confidence || "low",
    note: typeof p.note === "string" ? p.note : "",
  };
}

export const EARNING_PLATFORMS = [
  "DoorDash",
  "Uber Eats",
  "Uber Driver",
  "Instacart",
  "Spark Driver",
  "Shipt",
  "Grubhub",
  "Amazon Flex",
  "Veho",
  "Roadie",
  "Other",
];
