// LOKIN Beep Seek — Web Audio homing beeper for the in-store item locator.
// The beep interval shortens (and pitch rises) as the driver closes in on the
// target barcode; supported devices also buzz on each beep when nearly locked.
export function createBeepSeeker() {
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  let ctx = null;
  let timer = null;
  let running = false;
  let muted = false;
  let onTarget = false;
  let proximity = 0;

  function ensureCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    return ctx;
  }

  function beep(freq, duration) {
    const audio = ensureCtx();
    if (!audio || audio.state !== "running" || muted) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const now = audio.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function loop() {
    if (!running) return;
    if (onTarget && !muted) {
      // Far from the target: about one beep per second. Locked on: a
      // continuous rapid chirp.
      const interval = Math.max(90, Math.round(950 - proximity * 850));
      beep(680 + proximity * 620, 0.05 + proximity * 0.04);
      if (canVibrate && proximity >= 0.75) navigator.vibrate(15);
      timer = setTimeout(loop, interval);
    } else {
      timer = setTimeout(loop, 250);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      ensureCtx();
      loop();
    },
    resume() {
      const audio = ensureCtx();
      if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    },
    setProximity({ proximity: next, onTarget: targeted }) {
      proximity = Math.max(0, Math.min(1, Number(next) || 0));
      onTarget = Boolean(targeted);
    },
    setMuted(value) {
      muted = Boolean(value);
      if (muted && canVibrate) navigator.vibrate(0);
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}