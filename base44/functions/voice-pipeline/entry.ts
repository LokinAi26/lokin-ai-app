// LOKIN Voice Pipeline — gateway-powered speech for the native iOS app.
//
// The installed iPhone app runs in a WKWebView where the browser Web Speech
// APIs are broken: speechSynthesis.speak() is silent (voices list, no audio)
// and SpeechRecognition is unavailable/unreliable. So voice I/O runs through
// here instead: transcribe (OpenAI speech-to-text) + speak (OpenAI TTS).
// The app records with MediaRecorder, posts base64 audio, and plays back the
// returned MP3 through an <audio> element, which DOES work in the web view.
//
// Actions: { action: "transcribe", audio, mimeType, durationMs }
//          { action: "speak", text, voice }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { paidAiFallbackAllowed } from "../../shared/nvidiaInference.js";

const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const TTS_MODEL = "tts-1";
// Conservative cost estimates for usage telemetry.
const TRANSCRIBE_USD_PER_MIN = 0.006;
const TTS_USD_PER_MILLION_CHARS = 15;

const ALLOWED_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"];

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as any);
  }
  return btoa(s);
}

async function logUsage(base44: any, user: any, fields: Record<string, any>) {
  try {
    await base44.asServiceRole.entities.OpenAIUsageEvent.create({
      user_id: user.id,
      request_id: String(fields.request_id || ""),
      model: fields.model,
      mode: "voice",
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: Number(fields.estimated_cost_usd || 0),
      status: fields.status || "success",
      occurred_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("voice-pipeline usage telemetry unavailable", (e as any)?.message || e);
  }
}

export default async function (req: any) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const apiKey = paidAiFallbackAllowed() ? secrets.get("OPENAI_API_KEY") : "";
    if (!apiKey) {
      return Response.json(
        { error: "Voice provider is not configured right now.", provider: "voice-pipeline", configured: false },
        { status: 503 }
      );
    }

    // Budget guardian: same monthly cap as the AI gateway. Voice spend is tiny,
    // but it must never blow past a cap Kendall set.
    try {
      const configs = await base44.asServiceRole.entities.OpenAIGuardianConfig.filter({ user_id: user.id }, "-updated_date", 1);
      const gc = configs?.[0] || null;
      if (gc?.enabled !== false && Number(gc?.monthly_budget_usd || 0) > 0) {
        const events = await base44.asServiceRole.entities.OpenAIUsageEvent.filter(
          { user_id: user.id, occurred_at: { $gte: monthStart() } }, "-occurred_at", 500
        );
        const spent = (events || []).reduce((s: number, e: any) => s + Number(e.estimated_cost_usd || 0), 0);
        if (spent >= Number(gc.monthly_budget_usd) && gc.block_when_over_budget === true) {
          return Response.json(
            { error: "OpenAI monthly budget cap reached", provider: "guardian", guardian: { mode: "block", blocked: true, api_key_exposed: false } },
            { status: 429 }
          );
        }
      }
    } catch (e) {
      console.warn("voice-pipeline guardian preflight unavailable", (e as any)?.message || e);
    }

    if (action === "transcribe") {
      const audioB64 = String(body.audio || "");
      if (!audioB64) return Response.json({ error: "Missing audio" }, { status: 400 });
      if (audioB64.length > 12_000_000) return Response.json({ error: "Audio too long" }, { status: 413 });

      const mimeType = String(body.mimeType || "audio/webm").slice(0, 80);
      const ext = /mp4|m4a|aac/.test(mimeType) ? "m4a" : "webm";
      const form = new FormData();
      form.append("file", new File([b64ToBytes(audioB64)], `utterance.${ext}`, { type: mimeType }));
      form.append("model", TRANSCRIBE_MODEL);
      form.append("language", "en");

      let r: Response;
      try {
        r = await fetch(TRANSCRIBE_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: AbortSignal.timeout(30000),
        });
      } catch (e) {
        await logUsage(base44, user, { model: TRANSCRIBE_MODEL, status: "provider_error" });
        return Response.json({ error: "Transcription request failed" }, { status: 502 });
      }
      if (!r.ok) {
        await logUsage(base44, user, { model: TRANSCRIBE_MODEL, status: "provider_error" });
        return Response.json({ error: "Transcription provider error", provider_status: r.status }, { status: 502 });
      }
      const data = await r.json().catch(() => ({}));
      const text = String(data.text || "").trim();
      const minutes = Math.max(1 / 60, Number(body.durationMs || 8000) / 60000);
      await logUsage(base44, user, {
        model: TRANSCRIBE_MODEL,
        estimated_cost_usd: Number((minutes * TRANSCRIBE_USD_PER_MIN).toFixed(6)),
      });
      return Response.json({ text, provider: "openai", model: TRANSCRIBE_MODEL });
    }

    if (action === "speak") {
      const voice = ALLOWED_VOICES.includes(String(body.voice)) ? String(body.voice) : "onyx";
      const input = String(body.text || "").slice(0, 2000).trim();
      if (!input) return Response.json({ error: "Missing text" }, { status: 400 });

      let r: Response;
      try {
        r = await fetch(SPEECH_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: TTS_MODEL, input, voice, response_format: "mp3" }),
          signal: AbortSignal.timeout(25000),
        });
      } catch (e) {
        await logUsage(base44, user, { model: TTS_MODEL, status: "provider_error" });
        return Response.json({ error: "Speech request failed" }, { status: 502 });
      }
      if (!r.ok) {
        await logUsage(base44, user, { model: TTS_MODEL, status: "provider_error" });
        return Response.json({ error: "Speech provider error", provider_status: r.status }, { status: 502 });
      }
      const buf = await r.arrayBuffer();
      await logUsage(base44, user, {
        model: TTS_MODEL,
        estimated_cost_usd: Number(((input.length / 1_000_000) * TTS_USD_PER_MILLION_CHARS).toFixed(6)),
      });
      return Response.json({ audio: bytesToB64(buf), mimeType: "audio/mpeg", voice, provider: "openai", model: TTS_MODEL });
    }

    return Response.json({ error: `Unknown voice-pipeline action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("voice-pipeline", e);
    return Response.json({ error: "Voice pipeline unavailable" }, { status: 500 });
  }
}
