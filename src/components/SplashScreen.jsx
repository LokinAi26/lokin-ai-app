import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LokinGlyph, LokinWordmark } from "@/components/Brand";

export default function SplashScreen() {
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [phase, setPhase] = useState(0); // 0 closed · 1 bolts · 2 doors split · 3 reveal
  const playedRef = useRef(false);

  useEffect(() => {
    playVault();
    const timers = [
      setTimeout(() => setPhase(1), 700),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2050),
      setTimeout(() => setLeaving(true), 2850),
      setTimeout(() => setDone(true), 3300),
    ];
    // fallback: if autoplay blocked, play on first gesture
    const onGesture = () => { if (!playedRef.current) playVault(); };
    window.addEventListener("pointerdown", onGesture, { once: true });
    return () => { timers.forEach(clearTimeout); window.removeEventListener("pointerdown", onGesture); };
  }, []);

  function dismiss() {
    if (leaving || done) return;
    setLeaving(true);
    setPhase(3);
    setTimeout(() => setDone(true), 450);
  }

  function playVault() {
    if (playedRef.current) return;
    let ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      playedRef.current = true;
    } catch { return; }
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // heavy clunk
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    noise.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 420;
    noise.connect(lp); lp.connect(master);
    noise.start(now);
    const clunk = ctx.createOscillator(); clunk.type = "sine"; clunk.frequency.value = 120;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.7, now); cg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    clunk.connect(cg); cg.connect(master); clunk.start(now); clunk.stop(now + 0.26);

    // tumbler clicks
    [0.5, 0.78, 1.06].forEach((t, i) => {
      const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 340 - i * 35;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.linearRampToValueAtTime(0.2, now + t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.055);
      o.connect(g); g.connect(master); o.start(now + t); o.stop(now + t + 0.07);
    });

    // whoosh
    const n2 = ctx.createBufferSource();
    const b2 = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
    const dd = b2.getChannelData(0);
    for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    n2.buffer = b2;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, now + 1.3);
    bp.frequency.exponentialRampToValueAtTime(3200, now + 1.92);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, now + 1.3);
    wg.gain.linearRampToValueAtTime(0.26, now + 1.72);
    wg.gain.exponentialRampToValueAtTime(0.0001, now + 1.97);
    n2.connect(bp); bp.connect(wg); wg.connect(master);
    n2.start(now + 1.3); n2.stop(now + 2);

    // unlock chime (C5 + G5)
    [523.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = ctx.createGain();
      const st = now + 2.0 + i * 0.04;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.24, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.9);
      o.connect(g); g.connect(master); o.start(st); o.stop(st + 1);
    });

    setTimeout(() => ctx.close().catch(() => {}), 3400);
  }

  if (done) return null;

  const split = phase >= 2;

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          onClick={dismiss}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
        >
          <div className="absolute inset-0 brand-grid opacity-30" />
          <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 50%, hsl(80 100% 50% / 0.10), transparent 60%)" }} />

          {/* Vault emblem */}
          <div className="relative h-52 w-52">
            {/* rotating gear ring */}
            <motion.svg
              viewBox="0 0 220 220"
              className="absolute inset-0 h-full w-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              style={{ filter: "drop-shadow(0 0 8px hsl(80 100% 50% / 0.4))" }}
            >
              <circle cx="110" cy="110" r="96" fill="none" stroke="hsl(80 100% 50% / 0.18)" strokeWidth="2" />
              {Array.from({ length: 24 }).map((_, i) => {
                const a = (i * Math.PI * 2) / 24;
                const x1 = 110 + Math.cos(a) * 96, y1 = 110 + Math.sin(a) * 96;
                const x2 = 110 + Math.cos(a) * 104, y2 = 110 + Math.sin(a) * 104;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(80 100% 50% / 0.5)" strokeWidth="3" />;
              })}
            </motion.svg>

            {/* revealed glyph */}
            <motion.div
              className="absolute inset-0 grid place-items-center"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: split ? 1 : 0.4, opacity: split ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
            >
              <LokinGlyph size={120} className="lokin-spin" />
            </motion.div>

            {/* left door */}
            <motion.div
              className="absolute left-0 top-0 h-full w-1/2 rounded-l-3xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, hsl(220 10% 18%), hsl(220 10% 8%))",
                border: "1px solid hsl(80 100% 50% / 0.35)",
                boxShadow: "inset -6px 0 16px -8px hsl(0 0% 0% / 0.8)",
              }}
              animate={{ x: split ? -120 : 0, opacity: split ? 0 : 1, rotate: split ? -8 : 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            >
              <DoorBolts phase={phase} side="left" />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-3 rounded-full bg-gradient-to-b from-white/30 to-white/5" />
            </motion.div>

            {/* right door */}
            <motion.div
              className="absolute right-0 top-0 h-full w-1/2 rounded-r-3xl overflow-hidden"
              style={{
                background: "linear-gradient(225deg, hsl(220 10% 18%), hsl(220 10% 8%))",
                border: "1px solid hsl(80 100% 50% / 0.35)",
                boxShadow: "inset 6px 0 16px -8px hsl(0 0% 0% / 0.8)",
              }}
              animate={{ x: split ? 120 : 0, opacity: split ? 0 : 1, rotate: split ? 8 : 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            >
              <DoorBolts phase={phase} side="right" />
              <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-10 w-3 rounded-full bg-gradient-to-b from-white/30 to-white/5" />
            </motion.div>

            {/* scan line */}
            <motion.div
              className="absolute left-2 right-2 h-0.5 bg-primary"
              style={{ boxShadow: "0 0 10px hsl(80 100% 50%)" }}
              initial={{ top: "8%" }}
              animate={{ top: ["8%", "92%", "8%"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Wordmark reveal */}
          <motion.div
            className="mt-8 flex flex-col items-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: phase >= 3 ? 1 : 0, y: phase >= 3 ? 0 : 10 }}
            transition={{ duration: 0.5 }}
          >
            <LokinWordmark size={34} />
            <div className="mt-2 text-[10px] tracking-[0.32em] text-primary/70 font-display">UNLOCK YOUR TIME</div>
          </motion.div>

          <div className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] text-[10px] tracking-[0.2em] text-white/30">
            {phase < 3 ? "UNLOCKING…" : "TAP TO ENTER"}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DoorBolts({ phase, side }) {
  const retract = phase >= 1;
  const dir = side === "left" ? -1 : 1;
  const rows = [20, 50, 80];
  return (
    <>
      {rows.map((top) => (
        <motion.div
          key={top}
          className="absolute top-0 h-5 w-5 rounded-full"
          style={{
            [side === "left" ? "right" : "left"]: "8px",
            top: `${top}%`,
            transform: "translateY(-50%)",
            background: "linear-gradient(180deg, #dfe4ec, #7d848f)",
            boxShadow: "0 0 6px hsl(80 100% 50% / 0.4)",
          }}
          animate={{ x: retract ? dir * 6 : 0, opacity: retract ? 0.4 : 1 }}
          transition={{ duration: 0.25 }}
        />
      ))}
    </>
  );
}