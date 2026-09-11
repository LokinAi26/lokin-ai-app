import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

// Original, royalty-free lock-engagement sound synthesized with the Web Audio API.
// 1) soft low electronic pulse  2) rising confirmation tone  3) crisp metallic lock click.
function playLockSound(ctxRef) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctxRef.current) ctxRef.current = new AC();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const out = ctx.destination;

    // 1. soft low electronic pulse (sine ~90Hz)
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "sine";
    o1.frequency.setValueAtTime(90, now);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.16, now + 0.04);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    o1.connect(g1).connect(out);
    o1.start(now);
    o1.stop(now + 0.3);

    // 2. rising confirmation tone (triangle 320 -> 720Hz)
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(320, now + 0.12);
    o2.frequency.exponentialRampToValueAtTime(720, now + 0.42);
    g2.gain.setValueAtTime(0, now + 0.12);
    g2.gain.linearRampToValueAtTime(0.13, now + 0.18);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    o2.connect(g2).connect(out);
    o2.start(now + 0.12);
    o2.stop(now + 0.55);

    // 3. crisp metallic lock click (bandpass noise burst + sharp square tick)
    const dur = 0.12;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 6;
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.5, now + 0.46);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    noise.connect(bp).connect(g3).connect(out);
    noise.start(now + 0.46);
    noise.stop(now + 0.62);

    const o4 = ctx.createOscillator();
    const g4 = ctx.createGain();
    o4.type = "square";
    o4.frequency.setValueAtTime(1500, now + 0.46);
    g4.gain.setValueAtTime(0.0001, now + 0.46);
    g4.gain.linearRampToValueAtTime(0.1, now + 0.48);
    g4.gain.exponentialRampToValueAtTime(0.001, now + 0.57);
    o4.connect(g4).connect(out);
    o4.start(now + 0.46);
    o4.stop(now + 0.6);
  } catch {
    /* audio unavailable — silent fallback */
  }
}

function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function LockClockAnim({ phase }) {
  const gid = `lockin-${Math.random().toString(36).slice(2, 8)}`;
  const reduced = prefersReduced();

  if (reduced) {
    return (
      <motion.svg
        width={120} height={120} viewBox="0 0 100 100" fill="none"
        initial={{ scale: 0.85, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <circle cx="50" cy="58" r="38" fill="#8FE44E" opacity="0.08" />
        <path d="M35 40 V27 a15 15 0 0 1 30 0 V40" stroke="#8FE44E" strokeWidth="8" strokeLinecap="round" />
        <circle cx="50" cy="58" r="33" fill="#050608" stroke="#c8ced8" strokeWidth="5" />
        <line x1="50" y1="58" x2="50" y2="41" stroke="#fff" strokeWidth="3.8" strokeLinecap="round" />
        <line x1="50" y1="58" x2="64" y2="50" stroke="#8FE44E" strokeWidth="4" strokeLinecap="round" />
      </motion.svg>
    );
  }

  const locked = phase === "locked";

  return (
    <svg width={140} height={140} viewBox="0 0 100 100" fill="none" role="img" aria-label="LOKIN lock clock activating">
      <defs>
        <linearGradient id={`${gid}-neon`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d7ff45" />
          <stop offset="50%" stopColor="#8FE44E" />
          <stop offset="100%" stopColor="#39b900" />
        </linearGradient>
        <linearGradient id={`${gid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#c8ced8" />
          <stop offset="100%" stopColor="#707783" />
        </linearGradient>
        <radialGradient id={`${gid}-face`} cx="45%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#171b20" />
          <stop offset="100%" stopColor="#020304" />
        </radialGradient>
        <filter id={`${gid}-glow`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* halo pulse */}
      <motion.circle cx="50" cy="58" r="38" fill="#8FE44E"
        initial={{ opacity: 0.08, scale: 1 }}
        animate={{ opacity: locked ? [0.2, 0.3, 0.2] : [0.08, 0.22, 0.08], scale: locked ? 1.04 : 1.08 }}
        style={{ transformBox: "view-box", transformOrigin: "50px 58px" }}
        transition={{ duration: 0.8, repeat: Infinity }}
        filter={`url(#${gid}-glow)`}
      />

      {/* expanding neon ripple */}
      <motion.circle cx="50" cy="58" r="32" fill="none" stroke={`url(#${gid}-neon)`} strokeWidth="2.5"
        initial={{ scale: 0.5, opacity: 0.6 }}
        animate={{ scale: 2.4, opacity: 0 }}
        style={{ transformBox: "view-box", transformOrigin: "50px 58px" }}
        transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
      />

      {/* sweeping ring (clock sweep) */}
      <motion.circle cx="50" cy="58" r="46" fill="none" stroke={`url(#${gid}-neon)`} strokeWidth="3"
        strokeDasharray="46 243" strokeLinecap="round"
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 360, opacity: locked ? 0 : 1 }}
        style={{ transformBox: "view-box", transformOrigin: "50px 58px" }}
        transition={{ duration: 0.7, delay: 0.12, ease: "easeInOut" }}
      />

      {/* padlock shackle */}
      <path d="M35 40 V27 a15 15 0 0 1 30 0 V40" stroke={`url(#${gid}-neon)`} strokeWidth="8" strokeLinecap="round" fill="none" filter={`url(#${gid}-glow)`} />
      {/* shackle crossbar closes the lock */}
      <motion.line x1="33" y1="40" x2="67" y2="40" stroke={`url(#${gid}-neon)`} strokeWidth="6" strokeLinecap="round"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        style={{ transformBox: "view-box", transformOrigin: "50px 40px" }}
        transition={{ duration: 0.18, delay: 0.4, ease: "easeOut" }}
      />

      {/* metallic bezel + clock face */}
      <circle cx="50" cy="58" r="33" fill="#050608" stroke={`url(#${gid}-metal)`} strokeWidth="5" />
      <circle cx="50" cy="58" r="28" fill={`url(#${gid}-face)`} stroke={`url(#${gid}-neon)`} strokeWidth="2.5" />

      {/* twelve markers */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        const x1 = 50 + Math.cos(a) * 23;
        const y1 = 58 + Math.sin(a) * 23;
        const x2 = 50 + Math.cos(a) * 19;
        const y2 = 58 + Math.sin(a) * 19;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d8dde5" strokeWidth={i % 3 === 0 ? 2 : 1} opacity="0.9" />;
      })}

      {/* hour hand snaps forward */}
      <motion.line x1="50" y1="58" x2="50" y2="42" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round"
        initial={{ rotate: -18 }}
        animate={{ rotate: locked ? 42 : 42 }}
        style={{ transformBox: "view-box", transformOrigin: "50px 58px" }}
        transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.3 }}
      />
      {/* minute hand snaps forward */}
      <motion.line x1="50" y1="58" x2="66" y2="50" stroke={`url(#${gid}-neon)`} strokeWidth="4" strokeLinecap="round"
        initial={{ rotate: -30 }}
        animate={{ rotate: locked ? 115 : 115 }}
        style={{ transformBox: "view-box", transformOrigin: "50px 58px" }}
        transition={{ type: "spring", stiffness: 220, damping: 11, delay: 0.34 }}
      />
      <circle cx="50" cy="58" r="4" fill={`url(#${gid}-neon)`} stroke="#fff" strokeWidth="1.2" />
      <motion.path d="M50 63 l-3 5 h6 z" fill={`url(#${gid}-neon)`}
        initial={{ opacity: 0.2 }} animate={{ opacity: 0.95 }} transition={{ duration: 0.2, delay: 0.42 }} />
    </svg>
  );
}

// Full-screen cinematic LOCK IN activation overlay.
// Plays only after a user tap (created on gesture), guards against double-trigger,
// supports prefers-reduced-motion, then fires onComplete to enter the Work Mode screen.
export default function LockInSequence({ active, onComplete }) {
  const [phase, setPhase] = useState("locking"); // "locking" | "locked"
  const [visible, setVisible] = useState(false);
  const ctxRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setPhase("locking");
      setVisible(false);
      doneRef.current = false;
      return;
    }
    setVisible(true);
    const reduced = prefersReduced();
    playLockSound(ctxRef);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(reduced ? [25] : [15, 30, 45]); } catch { /* ignore */ }
    }
    const lockMs = reduced ? 380 : 780;
    const totalMs = reduced ? 950 : 1550;
    const t1 = setTimeout(() => setPhase("locked"), lockMs);
    const t2 = setTimeout(() => setVisible(false), totalMs - 250);
    const t3 = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete();
      }
    }, totalMs);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="lockin-overlay"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <LockClockAnim phase={phase} />
          <div className="mt-8 h-8">
            {phase === "locking" ? (
              <motion.div
                className="font-display text-base font-bold tracking-[0.3em] text-primary text-glow"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.7, repeat: Infinity }}
              >
                LOCKING IN…
              </motion.div>
            ) : (
              <motion.div
                className="flex items-center gap-2 font-display text-lg font-extrabold tracking-[0.16em] text-primary text-glow"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                YOU&apos;RE LOCKED IN
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}