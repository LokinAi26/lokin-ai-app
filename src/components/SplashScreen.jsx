import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SPLASH_ART = "/lokin-splash-master.avif";

export default function SplashScreen() {
  const [done, setDone] = useState(() => {
    try {
      const alreadyShown = sessionStorage.getItem("lokin_splash_seen") === "1";
      if (!alreadyShown) sessionStorage.setItem("lokin_splash_seen", "1");
      return alreadyShown;
    } catch {
      return false;
    }
  });
  const [leaving, setLeaving] = useState(false);
  const playedRef = useRef(false);

  useEffect(() => {
    if (done) return undefined;

    const onGesture = () => {
      if (!playedRef.current) playChime();
    };

    playChime();
    window.addEventListener("pointerdown", onGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onGesture);
    };
  }, [done]);

  function dismiss() {
    if (done || leaving) return;
    setLeaving(true);
    window.setTimeout(() => setDone(true), 420);
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
    } catch {
      return;
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.27;
    master.connect(ctx.destination);

    [523.25, 783.99].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const gain = ctx.createGain();
      const start = now + 0.08 + index * 0.13;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.05);

      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 1.15);
    });

    window.setTimeout(() => ctx.close().catch(() => {}), 2600);
  }

  if (done) return null;

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.section
          className="fixed inset-0 z-[100] overflow-hidden bg-black select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.012, filter: "blur(2px)" }}
          transition={{ duration: 0.42, ease: "easeInOut" }}
          aria-label="LOKIN AI introduction"
        >
          <img
            src={SPLASH_ART}
            alt="LOKIN AI — Unlock Your Potential. Level Up."
            className="absolute inset-0 h-full w-full object-cover object-center"
            draggable="false"
          />

          {/* Functional hit area positioned over the GET STARTED button already rendered in the artwork. */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Get started with LOKIN AI"
            className="absolute left-[9%] right-[9%] top-[81.2%] h-[8.4%] rounded-[24px] bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff20] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          />
        </motion.section>
      )}
    </AnimatePresence>
  );
}
