// LOKIN nav chimes — short Web Audio attention cues played just before each
// spoken navigation prompt so the driver perks up without glancing at the
// screen. Approach prompt = one soft tone; immediate turn prompt = a quick
// rising double chirp. Silently no-ops where Web Audio is unavailable or the
// context hasn't been unlocked by a user gesture yet.
let ctx = null;

function ensureCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, duration, delay = 0, peak = 0.18) {
  const audio = ensureCtx();
  if (!audio || audio.state !== "running") return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const now = audio.currentTime + delay;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playNavCue(kind) {
  if (kind === "imminent") {
    tone(880, 0.09);
    tone(1180, 0.12, 0.11);
  } else if (kind === "speeding") {
    // Low, short double tone — distinct from the turn chirps so the driver
    // can tell a speeding alert from a navigation cue without looking.
    tone(520, 0.09);
    tone(650, 0.1, 0.13);
  } else {
    tone(720, 0.08);
  }
}