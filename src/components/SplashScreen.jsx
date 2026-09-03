import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CreditCard,
  MapPinned,
  MessageCircleMore,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  { icon: MapPinned, title: "SMARTER ROUTES", subtitle: "MAXIMIZE EARNINGS" },
  { icon: ScanLine, title: "AI STORE ASSISTANT", subtitle: "FIND. SCAN. DELIVER." },
  { icon: MessageCircleMore, title: "AI DRIVER SUPPORT", subtitle: "HANDS-FREE HELP" },
  { icon: ShieldCheck, title: "SAFETY SENTINEL", subtitle: "PROTECT & PREPARE" },
  { icon: CreditCard, title: "LOKIN CARD", subtitle: "EARN. SAVE. LEVEL UP." },
];

const BUILDINGS = [
  [2, 44, 5], [8, 34, 4], [13, 53, 5], [19, 31, 4], [24, 42, 4],
  [29, 61, 5], [35, 36, 4], [40, 48, 4], [45, 39, 4], [50, 58, 5],
  [56, 41, 4], [61, 52, 4], [67, 35, 5], [72, 64, 5], [78, 43, 4],
  [83, 55, 5], [89, 38, 4], [95, 59, 5], [99, 46, 4],
];

function GreenChromeLock({ size = 86 }) {
  const uid = useId().replace(/:/g, "");
  const chrome = `${uid}-chrome`;
  const greenChrome = `${uid}-greenChrome`;
  const face = `${uid}-face`;
  const glow = `${uid}-glow`;
  const shine = `${uid}-shine`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="LOKIN green chrome lock clock logo"
    >
      <defs>
        <linearGradient id={chrome} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7fbff" />
          <stop offset="18%" stopColor="#6f7680" />
          <stop offset="38%" stopColor="#12161a" />
          <stop offset="55%" stopColor="#f4f7fa" />
          <stop offset="72%" stopColor="#343a41" />
          <stop offset="100%" stopColor="#050607" />
        </linearGradient>
        <linearGradient id={greenChrome} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#f0ff81" />
          <stop offset="18%" stopColor="#b9ff20" />
          <stop offset="42%" stopColor="#2b4408" />
          <stop offset="58%" stopColor="#d8ff53" />
          <stop offset="78%" stopColor="#6fa800" />
          <stop offset="100%" stopColor="#142500" />
        </linearGradient>
        <radialGradient id={face} cx="42%" cy="35%" r="68%">
          <stop offset="0%" stopColor="#161b14" />
          <stop offset="55%" stopColor="#050805" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <filter id={glow} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.92" />
          <stop offset="42%" stopColor="white" stopOpacity="0.06" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      <ellipse cx="50" cy="59" rx="39" ry="38" fill="#98ff00" opacity="0.12" filter={`url(#${glow})`} />

      <path
        d="M31 43V29C31 17.8 39.4 10 50 10s19 7.8 19 19v14"
        stroke={`url(#${greenChrome})`}
        strokeWidth="9"
        strokeLinecap="round"
        filter={`url(#${glow})`}
      />
      <path
        d="M34.5 42V29.5C34.5 20.3 41 14 50 14s15.5 6.3 15.5 15.5V42"
        stroke="#0a0f08"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.78"
      />

      <circle cx="50" cy="59" r="37" fill="#050706" stroke={`url(#${chrome})`} strokeWidth="7" />
      <circle cx="50" cy="59" r="31" fill={`url(#${face})`} stroke={`url(#${greenChrome})`} strokeWidth="3.1" />
      <path d="M24 42c9-12 22-17 39-14" stroke={`url(#${shine})`} strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />

      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * Math.PI) / 6 - Math.PI / 2;
        const inner = i % 3 === 0 ? 22 : 24;
        const outer = 28;
        const x1 = 50 + Math.cos(angle) * inner;
        const y1 = 59 + Math.sin(angle) * inner;
        const x2 = 50 + Math.cos(angle) * outer;
        const y2 = 59 + Math.sin(angle) * outer;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i % 3 === 0 ? "#eaff8f" : "#9dff00"}
            strokeWidth={i % 3 === 0 ? 2.2 : 1.25}
            strokeLinecap="round"
            opacity="0.95"
          />
        );
      })}

      <line x1="50" y1="59" x2="50" y2="42" stroke="#f6f7f8" strokeWidth="3.7" strokeLinecap="round" />
      <line x1="50" y1="59" x2="64" y2="50" stroke="#a6ff00" strokeWidth="4" strokeLinecap="round" filter={`url(#${glow})`} />
      <circle cx="50" cy="59" r="4.1" fill="#a6ff00" stroke="#f8fff0" strokeWidth="1.2" />
    </svg>
  );
}

function SplashWordmark() {
  return (
    <div className="flex items-center justify-center whitespace-nowrap font-display font-black leading-none">
      <span className="splash-metal text-[clamp(48px,13vw,94px)] tracking-[0.02em]">L</span>
      <div className="-mx-[clamp(5px,1vw,10px)] -my-4 flex shrink-0 items-center justify-center">
        <GreenChromeLock size={92} />
      </div>
      <span className="splash-metal text-[clamp(48px,13vw,94px)] tracking-[0.03em]">KIN</span>
      <span className="ml-[clamp(8px,2vw,18px)] text-[clamp(25px,7vw,52px)] font-black tracking-[0.02em] text-[#b9ff20] drop-shadow-[0_0_12px_rgba(166,255,0,.28)]">AI</span>
    </div>
  );
}

function CityBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[#010301]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_39%,rgba(113,196,24,.19),transparent_30%),radial-gradient(circle_at_50%_63%,rgba(141,255,0,.08),transparent_38%),linear-gradient(to_bottom,#010201_0%,#041006_40%,#020602_74%,#010201_100%)]" />

      <div className="absolute inset-x-0 top-[4%] h-[46%] overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[93%]">
          {BUILDINGS.map(([left, height, width], index) => {
            const tall = height >= 53;
            return (
              <div
                key={`${left}-${height}`}
                className="absolute bottom-0 border-x border-lime-200/10"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  transform: "translateX(-50%)",
                  clipPath: tall
                    ? "polygon(15% 11%, 42% 11%, 50% 0, 58% 11%, 85% 11%, 100% 100%, 0 100%)"
                    : "polygon(8% 5%, 92% 5%, 100% 100%, 0 100%)",
                  background:
                    "linear-gradient(90deg,rgba(1,4,2,.99),rgba(7,14,8,.97) 48%,rgba(1,3,2,.99)),repeating-linear-gradient(0deg,transparent 0 8px,rgba(167,255,43,.14) 8px 9px)",
                  boxShadow: index % 3 === 0 ? "0 0 16px rgba(141,255,0,.08)" : "none",
                }}
              >
                <div
                  className="absolute inset-[12%_18%_7%] opacity-80"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg,rgba(185,255,60,.62) 0 1px,transparent 1px 8px),repeating-linear-gradient(0deg,rgba(185,255,60,.28) 0 2px,transparent 2px 11px)",
                  }}
                />
                {tall && <div className="absolute left-1/2 top-0 h-[17%] w-px -translate-x-1/2 -translate-y-[80%] bg-lime-300/70 shadow-[0_0_7px_rgba(141,255,0,.8)]" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute inset-x-0 top-[42%] h-px bg-lime-300/10 shadow-[0_0_20px_rgba(141,255,0,.18)]" />

      <div className="absolute inset-x-[-28%] bottom-[-10%] h-[68%] overflow-hidden">
        <div
          className="absolute inset-0 origin-bottom opacity-55"
          style={{
            backgroundImage:
              "linear-gradient(rgba(141,255,0,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(141,255,0,.14) 1px,transparent 1px)",
            backgroundSize: "58px 48px",
            transform: "perspective(480px) rotateX(61deg) scale(1.25)",
            transformOrigin: "50% 100%",
            maskImage: "linear-gradient(to top,black 20%,rgba(0,0,0,.72) 63%,transparent 100%)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_52%,rgba(141,255,0,.09),transparent_48%)]" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.06),rgba(0,0,0,.04)_48%,rgba(0,0,0,.38)_100%)]" />
    </>
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
    const revealTimer = window.setTimeout(() => setReveal(true), 120);
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
    if (done || leaving) return;
    setLeaving(true);
    window.setTimeout(() => setDone(true), 480);
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
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = now + 0.08 + index * 0.13;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.05);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 1.15);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 2500);
  }

  if (done) return null;

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.section
          className="fixed inset-0 z-[100] isolate overflow-hidden bg-black text-white select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015, filter: "blur(3px)", transition: { duration: 0.46, ease: "easeInOut" } }}
          aria-label="LOKIN AI introduction"
        >
          <style>{`
            .splash-metal {
              color: transparent;
              background: linear-gradient(180deg,#ffffff 0%,#d8dce1 24%,#596068 51%,#fafafa 68%,#2e343a 100%);
              -webkit-background-clip: text;
              background-clip: text;
              text-shadow: 0 2px 2px rgba(0,0,0,.55),0 0 12px rgba(255,255,255,.04);
            }
          `}</style>

          <CityBackdrop />

          <motion.div
            className="relative z-10 mx-auto flex h-[100svh] w-full max-w-[980px] flex-col items-center px-[clamp(14px,3vw,34px)] pb-[max(18px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))]"
            initial={{ opacity: 0, y: 10 }}
            animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
              <div className="w-full translate-y-[-1.5vh] text-center">
                <SplashWordmark />
                <div className="mt-[clamp(10px,1.7vh,22px)] font-display text-[clamp(10px,2.55vw,20px)] tracking-[0.17em] text-[#caff58] drop-shadow-[0_0_9px_rgba(141,255,0,.22)] sm:tracking-[0.26em]">
                  UNLOCK YOUR POTENTIAL <span className="px-1">•</span> LEVEL UP
                </div>
              </div>

              <motion.div
                className="mt-[clamp(72px,14vh,155px)] grid w-full grid-cols-5 gap-[clamp(2px,1vw,12px)]"
                initial={{ opacity: 0, y: 12 }}
                animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.6, delay: 0.14 }}
              >
                {FEATURES.map(({ icon: Icon, title, subtitle }) => (
                  <div key={title} className="min-w-0 border-r border-lime-300/10 px-[clamp(1px,.6vw,8px)] text-center last:border-r-0">
                    <div className="mx-auto flex h-[clamp(37px,8vw,64px)] w-[clamp(37px,8vw,64px)] items-center justify-center text-[#b9ff20] drop-shadow-[0_0_10px_rgba(141,255,0,.38)]">
                      <Icon className="h-full w-full" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 min-h-[2.4em] font-display text-[clamp(7px,1.7vw,13px)] font-semibold leading-[1.18] tracking-[0.01em] text-zinc-100">
                      {title}
                    </div>
                    <div className="mx-auto mt-2 h-px w-5 bg-lime-300/85" />
                    <div className="mt-2 font-display text-[clamp(6px,1.55vw,12px)] leading-[1.35] tracking-[0.01em] text-[#b9ff20]">
                      {subtitle}
                    </div>
                  </div>
                ))}
              </motion.div>

              <motion.button
                type="button"
                onClick={dismiss}
                className="relative mt-[clamp(26px,4.8vh,54px)] min-h-12 w-[min(620px,82vw)] overflow-hidden rounded-[clamp(18px,3vw,28px)] border border-[#b9ff20] bg-black/60 px-8 py-[clamp(12px,1.8vh,19px)] font-display text-[clamp(16px,4vw,28px)] font-black tracking-[0.14em] text-[#b9ff20] shadow-[0_0_22px_rgba(141,255,0,.18),inset_0_0_18px_rgba(141,255,0,.04)] outline-none transition hover:bg-lime-300/5 hover:shadow-[0_0_30px_rgba(141,255,0,.28),inset_0_0_22px_rgba(141,255,0,.07)] focus-visible:ring-2 focus-visible:ring-lime-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.985]"
                initial={{ opacity: 0, y: 10 }}
                animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ duration: 0.55, delay: 0.22 }}
                whileTap={{ scale: 0.985 }}
              >
                <span className="pointer-events-none absolute inset-x-[16%] top-0 h-px bg-gradient-to-r from-transparent via-lime-100 to-transparent opacity-80" />
                <span className="relative">GET STARTED</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
