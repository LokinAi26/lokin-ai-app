import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SPLASH_SEEN_KEY = "lokin_splash_seen";
const SPLASH_IMAGE = "/lokin-approved-splash.webp";

export default function SplashScreen() {
  const [done, setDone] = useState(() => {
    try {
      const alreadyShown = sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
      if (!alreadyShown) sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
      return alreadyShown;
    } catch {
      return false;
    }
  });
  const [leaving, setLeaving] = useState(false);
  const playedRef = useRef(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (done) return undefined;

    playChime();

    const retryChime = () => {
      if (!playedRef.current) playChime();
    };

    window.addEventListener("pointerdown", retryChime, { once: true });

    return () => {
      window.removeEventListener("pointerdown", retryChime);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, [done]);

  function dismiss() {
    if (done || leaving) return;
    setLeaving(true);
    closeTimerRef.current = window.setTimeout(() => setDone(true), 420);
  }

  function playChime() {
    if (playedRef.current) return;

    let context;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      context = new AudioContextClass();
      if (context.state === "suspended") context.resume().catch(() => {});
      playedRef.current = true;
    } catch {
      return;
    }

    const now = context.currentTime;
    const master = context.createGain();
    master.gain.value = 0.28;
    master.connect(context.destination);

    [523.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + 0.08 + index * 0.13;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.05);

      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 1.15);
    });

    window.setTimeout(() => context.close().catch(() => {}), 2600);
  }

  if (done) return null;

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.section
          className="fixed inset-0 z-[100] isolate overflow-hidden bg-black select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.01, transition: { duration: 0.4, ease: "easeInOut" } }}
          onClick={dismiss}
          role="dialog"
          aria-modal="true"
          aria-label="LOKIN AI introduction"
        >
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <img
              src={SPLASH_IMAGE}
              alt="LOKIN AI — Unlock Your Potential, Level Up"
              className="block h-full w-full object-contain object-center"
              draggable="false"
              fetchPriority="high"
            />
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              dismiss();
            }}
            className="absolute bottom-[4.5%] left-1/2 z-10 h-[10%] w-[82%] -translate-x-1/2 cursor-pointer rounded-[28px] bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#baff00] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Get started with LOKIN AI"
          />
        </motion.section>
      )}
    </AnimatePresence>
  );
}
