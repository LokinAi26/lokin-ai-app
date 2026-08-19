import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LokinGlyph, LokinWordmark } from "@/components/Brand";

export default function SplashScreen() {
  const [done, setDone] = useState(() => {
    try {
      const alreadyShown = sessionStorage.getItem('lokin_splash_seen') === '1';
      if (!alreadyShown) sessionStorage.setItem('lokin_splash_seen', '1');
      return alreadyShown;
    } catch {
      return false;
    }
  });
  const [leaving, setLeaving] = useState(false);
  const [reveal, setReveal] = useState(false);
  const playedRef = useRef(false);

  useEffect(() => {
    playChime();
    const startedAt = Date.now();
    const timers = [
      setTimeout(() => setReveal(true), 250),
      setTimeout(() => setLeaving(true), 2200),
      setTimeout(() => setDone(true), 2750),
    ];
    const watchdog = setInterval(() => {
      if (Date.now() - startedAt >= 4000) setDone(true);
    }, 500);
    const onGesture = () => { if (!playedRef.current) playChime(); };
    window.addEventListener("pointerdown", onGesture, { once: true });
    return () => { timers.forEach(clearTimeout); clearInterval(watchdog); window.removeEventListener("pointerdown", onGesture); };
  }, []);

  function dismiss() {
    if (leaving || done) return;
    setLeaving(true);
    setTimeout(() => setDone(true), 500);
  }

  function playChime() {
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
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    // soft two-note chime
    [523.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      const st = now + 0.1 + i * 0.12;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.22, st + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 1.1);
      o.connect(g).connect(master);
      o.start(st);
      o.stop(st + 1.2);
    });

    setTimeout(() => ctx.close().catch(() => {}), 2800);
  }

  if (done) return null;

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          onClick={dismiss}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(4px)", transition: { duration: 0.5, ease: "easeInOut" } }}
        >
          <div className="absolute inset-0" style={{ background: "radial-gradient(100% 60% at 50% 50%, hsl(80 100% 50% / 0.08), transparent 65%)" }} />

          {/* Glyph with gentle glow pulse */}
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={reveal ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
          >
            <motion.div
              className="absolute inset-0 -z-10"
              animate={{ opacity: [0.3, 0.55, 0.3], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "radial-gradient(circle, hsl(80 100% 50% / 0.25), transparent 60%)", filter: "blur(20px)" }}
            />
            <LokinGlyph size={88} />
          </motion.div>

          {/* Wordmark */}
          <motion.div
            className="mt-7 flex flex-col items-center"
            initial={{ opacity: 0, y: 8 }}
            animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <LokinWordmark size={30} />
            <motion.div
              className="mt-2.5 text-[10px] tracking-[0.32em] text-primary/70 font-display"
              initial={{ opacity: 0 }}
              animate={reveal ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              UNLOCK YOUR POTENTIAL · LEVEL UP
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}