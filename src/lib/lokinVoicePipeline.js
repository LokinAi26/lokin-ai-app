// LOKIN Voice Pipeline — client side.
//
// The native iOS app's web view cannot use the browser Web Speech APIs
// (speechSynthesis is silent, SpeechRecognition is unavailable), so voice
// I/O goes through the `voice-pipeline` backend function: the app records
// with MediaRecorder, the gateway transcribes, and replies come back as MP3
// audio played through an <audio> element (which works in the web view).
//
// speakLokin() is the single entry point for all spoken output: gateway TTS
// first, device speechSynthesis as fallback where the pipeline is unreachable.

import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import { speakText } from "./lokinVoice";

// Voice-state event bus for HUD surfaces (e.g. VisionHud): fires exactly on
// real speech state transitions — never on a timer, never simulated.
function emitVoiceState(state) {
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("lokin:voice-state", { detail: { state } }));
    }
  } catch {}
}

const TTS_VOICE_KEY = "lokin_tts_voice";
const DEFAULT_TTS_VOICE = "onyx";

// OpenAI TTS voices. Short, plain labels — the picker shows these.
export const TTS_VOICES = [
  { id: "onyx", label: "Onyx", hint: "Deep male" },
  { id: "echo", label: "Echo", hint: "Male" },
  { id: "fable", label: "Fable", hint: "Male · British" },
  { id: "nova", label: "Nova", hint: "Female" },
  { id: "shimmer", label: "Shimmer", hint: "Female" },
  { id: "alloy", label: "Alloy", hint: "Neutral" },
];

export function getTtsVoice() {
  try {
    const v = localStorage.getItem(TTS_VOICE_KEY) || "";
    if (TTS_VOICES.some((t) => t.id === v)) return v;
  } catch {}
  return DEFAULT_TTS_VOICE;
}

export function setTtsVoice(id) {
  try {
    if (TTS_VOICES.some((t) => t.id === id)) localStorage.setItem(TTS_VOICE_KEY, id);
  } catch {}
}

// Turn-by-turn guidance voice — separate pick from the Ask LOKIN voice
// (Kendall 2026-09-27). Same OpenAI voice list, own persisted choice.
const GUIDANCE_VOICE_KEY = "lokin_guidance_voice";
const DEFAULT_GUIDANCE_VOICE = "onyx";

export function getGuidanceVoice() {
  try {
    const v = localStorage.getItem(GUIDANCE_VOICE_KEY) || "";
    if (TTS_VOICES.some((t) => t.id === v)) return v;
  } catch {}
  return DEFAULT_GUIDANCE_VOICE;
}

export function setGuidanceVoice(id) {
  try {
    if (TTS_VOICES.some((t) => t.id === id)) localStorage.setItem(GUIDANCE_VOICE_KEY, id);
  } catch {}
}

// Voice level: 0-150 percent, persisted. 100 = the MP3's native loudness;
// above 100 genuinely boosts it (via Web Audio gain, which iOS honors).
const TTS_VOLUME_KEY = "lokin_tts_volume";
const DEFAULT_TTS_VOLUME = 100;

export function getTtsVolume() {
  try {
    const v = Number(localStorage.getItem(TTS_VOLUME_KEY));
    if (Number.isFinite(v)) return Math.min(150, Math.max(0, Math.round(v)));
  } catch {}
  return DEFAULT_TTS_VOLUME;
}

export function setTtsVolume(v) {
  try {
    const n = Math.min(150, Math.max(0, Math.round(Number(v))));
    if (Number.isFinite(n)) localStorage.setItem(TTS_VOLUME_KEY, String(n));
  } catch {}
}

// Shared Web Audio context. iOS ignores the media element's volume property,
// so the level slider drives a GainNode instead — the one loudness control
// iOS actually honors. Created/resumed inside tap gestures (unlockVoiceAudio)
// so it is running by the time replies play.
let voiceCtx = null;
function ensureVoiceCtx() {
  try {
    if (typeof window === "undefined") return null;
    if (!voiceCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      voiceCtx = new AC();
    }
    if (voiceCtx.state === "suspended") voiceCtx.resume().catch(() => {});
    return voiceCtx;
  } catch {
    return null;
  }
}

export function canRecordVoice() {
  try {
    return Boolean(
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.getUserMedia &&
      typeof window !== "undefined" &&
      window.MediaRecorder
    );
  } catch {
    return false;
  }
}

// iOS web views require a user gesture before any audio plays. Call this from
// the mic tap so the reply audio is allowed to play later.
export function unlockVoiceAudio() {
  ensureVoiceCtx();
}

// Awaitable unlock for tap handlers: resolves once the shared context is
// running (or after a short bounded wait when iOS will not honor resume).
// Call this FIRST inside the tap, before any network await, so the resume
// lands inside the user-gesture window.
export async function unlockVoiceAudioAsync() {
  const ctx = ensureVoiceCtx();
  if (ctx && ctx.state !== "running") {
    try {
      await Promise.race([
        ctx.resume(),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    } catch {}
  }
  return ctx;
}

let currentAudio = null;

export function stopSpeaking() {
  try { if (currentAudio) currentAudio.pause(); } catch {}
  currentAudio = null;
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
  emitVoiceState("idle");
}

// Record one utterance. Resolves { stop, done } — done resolves a Blob.
// Tap again to stop early; auto-stops at maxMs.
export async function startVoiceRecording({ maxMs = 15000 } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const pickType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => {
    try { return window.MediaRecorder.isTypeSupported(t); } catch { return false; }
  });
  const rec = new MediaRecorder(stream, pickType ? { mimeType: pickType } : undefined);
  const chunks = [];
  let resolveDone, rejectDone;
  const done = new Promise((res, rej) => { resolveDone = res; rejectDone = rej; });
  rec.ondataavailable = (e) => { if (e?.data?.size) chunks.push(e.data); };
  const finish = () => { try { stream.getTracks().forEach((t) => t.stop()); } catch {} };
  rec.onstop = () => { finish(); resolveDone(new Blob(chunks, { type: rec.mimeType || "audio/webm" })); };
  rec.onerror = () => { finish(); rejectDone(new Error("recording failed")); };
  rec.start(250);
  const timer = setTimeout(() => { try { if (rec.state !== "inactive") rec.stop(); } catch {} }, maxMs);
  return {
    stop() { clearTimeout(timer); try { if (rec.state !== "inactive") rec.stop(); } catch {} },
    abort() {
      clearTimeout(timer);
      try { if (rec.state !== "inactive") rec.stop(); } catch {}
      finish();
      rejectDone(new Error("aborted"));
    },
    done,
  };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    fr.onerror = () => reject(new Error("audio encode failed"));
    fr.readAsDataURL(blob);
  });
}

export async function transcribeVoiceBlob(blob, durationMs = 0) {
  const audio = await blobToBase64(blob);
  const res = await guardedInvoke(
    base44,
    "voice-pipeline",
    { action: "transcribe", audio, mimeType: blob.type || "audio/webm", durationMs: Math.round(durationMs) },
    { userInitiated: true }
  );
  return String(res?.data?.text || "").trim();
}

// Speak via the gateway. Returns true when audio played, false on total failure.
export async function speakLokin(text, opts = {}) {
  const clean = String(text || "").replace(/[*#_`]/g, "").trim();
  if (!clean) return false;
  stopSpeaking();
  // Warm the audio pipeline before the network await: if this call came from
  // a tap, the resume lands inside the gesture window and iOS lets the later
  // audio.play() through. Bounded so gesture-less callers (nav prompts) can't
  // hang here.
  try { await unlockVoiceAudioAsync(); } catch {}
  // Emitted after stopSpeaking() (which reports idle) so a new utterance
  // reads as idle -> speaking, never speaking -> idle -> speaking.
  emitVoiceState("speaking");
  try {
    const res = await guardedInvoke(
      base44,
      "voice-pipeline",
      { action: "speak", text: clean.slice(0, 2000), voice: opts.voice || getTtsVoice() },
      { userInitiated: true }
    );
    const data = res?.data;
    if (!data?.audio) throw new Error("no audio returned");
    const audio = new Audio(`data:${data.mimeType || "audio/mpeg"};base64,${data.audio}`);
    try { audio.setAttribute("playsinline", ""); } catch {}
    const vol = getTtsVolume();
    // Element volume for platforms that honor it (attenuation only).
    try { audio.volume = Math.min(1, vol / 100); } catch {}
    // GainNode ONLY when the level differs from 100. iOS honors element.volume
    // unreliably, so the slider needs the Web Audio path — but audio routed
    // through an AudioContext is muted by the iOS silent switch, which kills
    // navigation prompts. At the default 100 the element plays directly,
    // audible regardless of the silent switch (verified 2026-09-27). Only
    // route when the shared context is running — a suspended context would
    // silence the reply, so then the element plays directly.
    if (vol !== 100) {
      const ctx = ensureVoiceCtx();
      if (ctx && ctx.state === "running") {
        try {
          const src = ctx.createMediaElementSource(audio);
          const gain = ctx.createGain();
          gain.gain.value = Math.min(1.5, Math.max(0, vol / 100));
          src.connect(gain);
          gain.connect(ctx.destination);
        } catch {}
      }
    }
    currentAudio = audio;
    await audio.play();
    // Reject — never silently swallow — decode errors and stalls. A preview
    // that "plays" with no sound must surface, not reset quietly (2026-09-29:
    // onerror used to resolve, masking broken audio as played).
    await new Promise((resolve, reject) => {
      let done = false;
      let iv = null;
      const finish = (err) => {
        if (done) return;
        done = true;
        if (iv) clearInterval(iv);
        if (err) reject(err); else resolve();
      };
      audio.onended = () => finish(null);
      audio.onerror = () => finish(new Error("audio playback failed"));
      const t0 = Date.now();
      iv = setInterval(() => {
        try {
          if (audio.ended || audio.currentTime > 0.05) return; // progressing; onended finishes it
          if (Date.now() - t0 > 5000) finish(new Error("audio stalled before producing sound"));
        } catch { finish(new Error("audio playback failed")); }
      }, 250);
    });
    // Single choke point for natural end-of-speech on the gateway path.
    emitVoiceState("idle");
    if (currentAudio === audio) currentAudio = null;
    return true;
  } catch (e) {
    currentAudio = null;
    // Strict mode (voice previews): surface the real failure to the caller
    // instead of falling back to device speechSynthesis, which is silent
    // inside the iOS web view and would mask the problem.
    if (opts.strict) throw e;
    // Guidance prompts must never fail silently (2026-09-29: a transient
    // gateway failure fell back to device speechSynthesis — silent inside
    // the iOS web view — while the HUD toggle still showed ON). Signal HUD
    // surfaces so the speaker button can show the failure instead.
    if (opts.guidance) emitVoiceState("guidance-error");
    // Consent or provider errors surface to the caller via the reply text path;
    // here we just try the device fallback so browsers still talk.
    try {
      return speakText(clean, { ...opts, volume: Math.min(1, getTtsVolume() / 100) });
    } catch {
      return false;
    }
  }
}

// Turn-by-turn guidance speech: gateway TTS with the driver's picked
// guidance voice. Works inside the iOS web view where device
// speechSynthesis is silent. New prompts interrupt the current one
// (speakLokin stops first) — correct for navigation.
export function speakGuidance(text) {
  return speakLokin(text, { voice: getGuidanceVoice(), guidance: true });
}

export default {
  TTS_VOICES,
  getTtsVoice,
  setTtsVoice,
  getGuidanceVoice,
  setGuidanceVoice,
  speakGuidance,
  getTtsVolume,
  setTtsVolume,
  canRecordVoice,
  unlockVoiceAudio,
  unlockVoiceAudioAsync,
  stopSpeaking,
  startVoiceRecording,
  transcribeVoiceBlob,
  speakLokin,
};