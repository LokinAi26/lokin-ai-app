import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const apiKey = secrets.get("OPENAI_API_KEY");
    if (!apiKey) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
    const b64 = String(body.audioBase64 || "");
    if (!b64 || b64.length > 8_000_000) return Response.json({ error: "Missing or oversized audio" }, { status: 400 });
    const mime = String(body.mimeType || "audio/webm").slice(0, 100);
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), `lokin-command.${ext}`);
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "en");
    form.append("prompt", "LOKIN voice assistant. Common phrases: Hey LOKIN, lock in, level up, pause, resume, tap out, find gas, what should I do next.");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ error: data?.error?.message || "Transcription failed" }, { status: r.status });
    return Response.json({ text: String(data.text || "").trim(), provider: "openai-transcribe" });
  } catch (e) {
    console.error("voice-transcribe", e);
    return Response.json({ error: "Voice transcription unavailable" }, { status: 500 });
  }
}
