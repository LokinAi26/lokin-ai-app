import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CreditCard,
  MapPinned,
  MessageCircleMore,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { LokinGlyph, LokinWordmark } from "@/components/Brand";

const FEATURES = [
  {
    icon: MapPinned,
    title: "SMARTER ROUTES",
    subtitle: "MAXIMIZE EARNINGS",
  },
  {
    icon: ScanLine,
    title: "AI STORE ASSISTANT",
    subtitle: "FIND. SCAN. DELIVER.",
  },
  {
    icon: MessageCircleMore,
    title: "AI DRIVER SUPPORT",
    subtitle: "HANDS-FREE HELP",
  },
  {
    icon: ShieldCheck,
    title: "SAFETY SENTINEL",
    subtitle: "PROTECT & PREPARE",
  },
  {
    icon: CreditCard,
    title: "LOKIN CARD",
    subtitle: "EARN. SAVE. LEVEL UP.",
  },
];

const BUILDINGS = [
  [1, 23, 4.3], [5, 38, 3.2], [8, 31, 5.0], [13, 56, 3.5], [17, 27, 4.8],
  [21, 43, 3.7], [25, 63, 3.1], [29, 34, 4.7], [34, 48, 4.1], [39, 28, 5.2],
  [44, 59, 3.3], [48, 39, 4.3], [53, 52, 3.6], [57, 30, 4.7], [62, 66, 3.2],
  [66, 37, 4.4], [71, 49, 3.8], [75, 29, 5.1], [80, 61, 3.2], [84, 40, 4.4],
  [89, 54, 3.5], [93, 32, 4.9], [97, 45, 3.0],
];

function CitySkyline() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[58%] overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_62%,rgba(140,255,0,0.12),transparent_36%),linear-gradient(to_bottom,rgba(0,0,0,0.05),rgba(0,0,0,0.78))]" />
      <div className="absolute inset-x-0 bottom-0 h-[88%] opacity-95">
        {BUILDINGS.map(([left, height, width], index) => {
          const tall = height > 52;
          return (
            <div
              key={`${left}-${height}`}
              className="absolute bottom-0 border-x border-lime-300/10"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                height: `${height}%`,
                transform: "translateX(-50%)",
                clipPath: tall
                  ? "polygon(16% 8%, 42% 8%, 50% 0, 58% 8%, 84% 8%, 100% 100%, 0 100%)"
                  : "polygon(8% 5%, 92% 5%, 100% 100%, 0 100%)",
                background:
                  "linear-gradient(90deg, rgba(3,8,5,.98), rgba(8,15,10,.95) 48%, rgba(2,6,4,.99)), repeating-linear-gradient(0deg, transparent 0 8px, rgba(151,255,35,.12) 8px 9px)",
                boxShadow:
                  index % 3 === 0
                    ? "0 0 18px rgba(141,255,0,.10), inset 1px 0 rgba(190,255,90,.12)"
                    : "inset 1px 0 rgba(190,255,90,.08)",
              }}
            >
              <div
                className="absolute inset-[12%_18%_8%] opacity-70"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, rgba(191,255,76,.7) 0 1px, transparent 1px 8px), repeating-linear-gradient(0deg, rgba(191,255,76,.38) 0 2px, transparent 2px 11px)",
                  maskImage: "linear-gradient(to bottom, rgba(0,0,0,.88), rgba(0,0,0,.22))",
                }}
              />
              {tall && (
                <div className="absolute left-1/2 top-0 h-[15%] w-px -translate-x-1/2 -translate-y-[82%] bg-lime-300/70 shadow-[0_0_8px_rgba(141,255,0,.85)]" />
              )}
            </div>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-[2%] h-px bg-lime-300/15 shadow-[0_0_18px_rgba(141,255,0,.35)]" />
    </div>
  );
}

function GridFloor() {
  return (
    <div className="pointer-events-none absolute inset-x-[-24%] bottom-[-18%] h-[62%] overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 origin-bottom opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(141,255,0,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(141,255,0,.16) 1px, transparent 1px)",
          backgroundSize: "56px 42px",
          transform: "perspective(420px) rotateX(58deg) scale(1.28)",
          transformOrigin: "50% 100%",
          maskImage: "linear-gradient(to top, black 18%, rgba(0,0,0,.72) 58%, transparent 100%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_85%,rgba(123,255,0,0.13),transparent_48%)]" />
    </div>
  );
}

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
  const [reveal, setReveal] = useState(false);
  const playedRef = useRef(false);

  useEffect(() => {
    if (done) return undefined;

    const revealTimer = window.setTimeout(() => setReveal(true), 140);
    const onGesture = () => {
      if (!playedRef.current) playChime();
    };

    playChime();
    window.addEventListener("pointerdown", onGesture, { once: true });

    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener("pointerdown", onGesture);
    };
  }, [done]);

  function dismiss() {
    if (leaving || done) return;
    setLeaving(true);
    window.setTimeout(() => setDone(true), 520);
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
          className="fixed inset-0 z-[100] isolate overflow-hidden bg-[#010201] text-white select-none"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.018,
            filter: "blur(3px)",
            transition: { duration: 0.5, ease: "easeInOut" },
          }}
          aria-label="LOKIN AI introduction"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(141,255,0,0.14),transparent_32%),linear-gradient(to_bottom,#020503_0%,#030804_50%,#010201_100%)]" />
          <CitySkyline />
          <GridFloor />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.02),rgba(0,0,0,.10)_46%,rgba(0,0,0,.45)_100%)]" />

          <motion.div
            className="relative z-10 mx-auto flex h-full w-full max-w-[1180px] flex-col items-center justify-center px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))] sm:px-7"
            initial={{ opacity: 0, y: 10 }}
            animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex w-full flex-col items-center">
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 8 }}
                animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.55, delay: 0.1 }}
              >
                <LokinWordmark
                  size={52}
                  className="scale-[0.82] sm:scale-100 [&_.metal-text]:drop-shadow-[0_1px_1px_rgba(255,255,255,0.22)]"
                />
                <div className="mt-1.5 text-center font-display text-[clamp(9px,1.15vw,15px)] tracking-[0.22em] text-lime-300/90 drop-shadow-[0_0_9px_rgba(141,255,0,.28)] sm:mt-2.5 sm:tracking-[0.3em]">
                  UNLOCK YOUR POTENTIAL <span className="px-1.5">•</span> LEVEL UP
                </div>
              </motion.div>
            </div>

            <motion.div
              className="mt-[clamp(20px,4vh,44px)] grid w-full grid-cols-5 gap-1.5 sm:gap-4 lg:gap-7"
              initial={{ opacity: 0, y: 12 }}
              animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.6, delay: 0.18 }}
            >
              {FEATURES.map(({ icon: Icon, title, subtitle }) => (
                <div key={title} className="min-w-0 text-center">
                  <div className="mx-auto flex h-[clamp(30px,5vw,58px)] w-[clamp(30px,5vw,58px)] items-center justify-center text-lime-300 drop-shadow-[0_0_10px_rgba(141,255,0,.55)]">
                    <Icon className="h-full w-full" strokeWidth={1.8} />
                  </div>
                  <div className="mt-2 truncate font-display text-[clamp(6px,1vw,12px)] font-semibold tracking-[0.03em] text-zinc-100">
                    {title}
                  </div>
                  <div className="mt-0.5 truncate font-display text-[clamp(5px,.88vw,11px)] tracking-[0.04em] text-lime-300/90">
                    {subtitle}
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.button
              type="button"
              onClick={dismiss}
              className="group relative mt-[clamp(24px,5vh,52px)] min-h-11 w-[min(340px,72vw)] overflow-hidden rounded-2xl border border-lime-300/90 bg-black/55 px-8 py-3 font-display text-[clamp(13px,1.5vw,18px)] font-black tracking-[0.13em] text-lime-300 shadow-[0_0_18px_rgba(141,255,0,.22),inset_0_0_20px_rgba(141,255,0,.05)] outline-none transition duration-200 hover:bg-lime-300/10 hover:shadow-[0_0_26px_rgba(141,255,0,.38),inset_0_0_22px_rgba(141,255,0,.08)] focus-visible:ring-2 focus-visible:ring-lime-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.985]"
              initial={{ opacity: 0, y: 10 }}
              animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.55, delay: 0.28 }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
            >
              <span className="pointer-events-none absolute inset-x-[14%] top-0 h-px bg-gradient-to-r from-transparent via-lime-100 to-transparent opacity-80" />
              <span className="relative">GET STARTED</span>
            </motion.button>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
