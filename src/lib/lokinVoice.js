// LOKIN Voice — single source of truth for speech synthesis voices.
//
// Kendall's requirement: real male and female voices only, user-pickable via a
// pull-down, applied everywhere speech is spoken (voice replies, turn-by-turn,
// coaches). Uses the device's real iOS voices via speechSynthesis.getVoices().
// Never fabricates voices — only lists what the device actually returns.

const STORE_KEY = "lokin_voice";
const RATE_KEY = "lokin_voice_rate";
const PITCH_KEY = "lokin_voice_pitch";

// Curated name -> gender map (Web Speech API exposes no gender property).
// Covers Apple's real human-recorded voices.
const VOICE_GENDERS = {
  // en-US
  samantha: "female", nicky: "female", susan: "female", ava: "female", allison: "female",
  aaron: "male", tom: "male",
  // en-GB
  martha: "female", serena: "female", kate: "female",
  daniel: "male", arthur: "male", oliver: "male",
  // en-AU
  karen: "female", catherine: "female",
  gordon: "male", lee: "male",
  // en-IE / en-ZA / en-IN common
  moira: "female", rishi: "male", karen2: "female",
};

let cachedVoices = [];
let loaded = false;
const listeners = new Set();

function synth() {
  return typeof window !== "undefined" ? window.speechSynthesis : null;
}

function genderOf(name) {
  const key = String(name || "").toLowerCase().split(" ")[0];
  return VOICE_GENDERS[key] || "unknown";
}

function refresh() {
  const s = synth();
  const list = s ? s.getVoices() || [] : [];
  // English real voices only, deduped by voiceURI.
  const seen = new Set();
  cachedVoices = list
    .filter((v) => v && v.lang && v.lang.toLowerCase().startsWith("en"))
    .filter((v) => {
      if (seen.has(v.voiceURI)) return false;
      seen.add(v.voiceURI);
      return true;
    })
    .map((v) => ({
      voice: v,
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      gender: genderOf(v.name),
    }))
    // Females first, then males, then unknown — alphabetical within group.
    .sort((a, b) => {
      const order = { female: 0, male: 1, unknown: 2 };
      return (order[a.gender] - order[b.gender]) || a.name.localeCompare(b.name);
    });
  loaded = true;
  listeners.forEach((fn) => { try { fn(cachedVoices); } catch {} });
}

export function loadVoices() {
  const s = synth();
  if (!s) return;
  refresh();
  try {
    s.addEventListener("voiceschanged", refresh);
  } catch {}
  // Fallback: some WebViews never fire voiceschanged promptly.
  setTimeout(() => { if (!cachedVoices.length) refresh(); }, 3000);
}

export function onVoices(fn) {
  listeners.add(fn);
  if (loaded) { try { fn(cachedVoices); } catch {} }
  return () => listeners.delete(fn);
}

export function getVoiceOptions() {
  return cachedVoices;
}

export function getStoredVoiceURI() {
  try {
    return localStorage.getItem(STORE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredVoiceURI(uri) {
  try {
    if (uri) localStorage.setItem(STORE_KEY, uri);
    else localStorage.removeItem(STORE_KEY);
  } catch {}
}

export function getStoredRate() {
  try {
    const v = parseFloat(localStorage.getItem(RATE_KEY));
    return Number.isFinite(v) && v >= 0.5 && v <= 2 ? v : 1.05;
  } catch {
    return 1.05;
  }
}

export function setStoredRate(v) {
  try { localStorage.setItem(RATE_KEY, String(v)); } catch {}
}

export function getStoredPitch() {
  try {
    const v = parseFloat(localStorage.getItem(PITCH_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 2 ? v : 1;
  } catch {
    return 1;
  }
}

export function setStoredPitch(v) {
  try { localStorage.setItem(PITCH_KEY, String(v)); } catch {}
}

// Apply the user's chosen voice + rate/pitch to an utterance.
// Synchronous against the cached list — never blocks or delays speak().
export function applyVoice(utterance) {
  if (!utterance) return utterance;
  try {
    const uri = getStoredVoiceURI();
    if (uri) {
      const found = cachedVoices.find((v) => v.voiceURI === uri);
      if (found) utterance.voice = found.voice;
    }
    utterance.rate = getStoredRate();
    utterance.pitch = getStoredPitch();
  } catch {}
  return utterance;
}

// Speak with iOS workarounds: warm the voice list, resume a suspended
// synthesis queue (the known iOS silent-speech failure), then speak.
export function speakText(text, opts = {}) {
  const s = synth();
  if (!s || !text) return false;
  try {
    if (!loaded) refresh();
    try { s.resume(); } catch {}
    const u = new SpeechSynthesisUtterance(String(text).replace(/[*#_`]/g, ""));
    applyVoice(u);
    if (opts.rate) u.rate = opts.rate;
    if (opts.pitch) u.pitch = opts.pitch;
    if (opts.volume != null) u.volume = opts.volume;
    // Avoid the iOS cancel-then-speak-in-same-task pattern that silently
    // kills the utterance: cancel first, then speak on the next tick.
    s.cancel();
    setTimeout(() => {
      try { s.speak(u); } catch {}
    }, 60);
    return true;
  } catch {
    return false;
  }
}

export default {
  loadVoices,
  onVoices,
  getVoiceOptions,
  getStoredVoiceURI,
  setStoredVoiceURI,
  getStoredRate,
  setStoredRate,
  getStoredPitch,
  setStoredPitch,
  applyVoice,
  speakText,
};