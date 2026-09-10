import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CreditCard, MessageCircle, Route as RouteIcon, ScanLine, ShieldCheck, X } from "lucide-react";
import { LOKIN_SKYLINE_BG, LokinWordmark } from "@/components/Brand";

// First-run marketing feature tour, shown once (localStorage seen-key)
// after the splash screen. GET STARTED routes to the existing
// permission-checklist onboarding. Tour cards for features that are not
// built yet carry explicit "Coming soon" labels so nothing is
// misrepresented.
const TOUR_SEEN_KEY = "lokin_tour_seen_v1";

const CARDS = [
  {
    icon: RouteIcon,
    title: "SMARTER ROUTES",
    desc: "MAXIMIZE EARNINGS",
    detail: "Road-matched routes that keep you earning, not circling the block.",
    soon: false,
  },
  {
    icon: ScanLine,
    title: "AI STORE ASSISTANT",
    desc: "FIND. SCAN. DELIVER.",
    detail: "In-store guidance for shop-and-deliver orders, aisle to doorstep.",
    soon: true,
  },
  {
    icon: MessageCircle,
    title: "AI DRIVER SUPPORT",
    desc: "HANDS-FREE HELP",
    detail: "Ask LOKIN anything while you drive — short spoken answers, eyes on the road.",
    soon: false,
  },
  {
    icon: ShieldCheck,
    title: "SAFETY SENTINEL",
    desc: "PROTECT & PREPARE",
    detail: "Stay linked, stay aware, and stay covered on every mile.",
    soon: false,
  },
  {
    icon: CreditCard,
    title: "LOKIN CARD",
    desc: "EARN. SAVE. LEVEL UP.",
    detail: "The driver's card for fuel, fees, and faster payouts.",
    soon: true,
  },
];

export default function FeatureTour() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(() => {
    try {
      if (localStorage.getItem(TOUR_SEEN_KEY) === "1") return false;
      localStorage.setItem(TOUR_SEEN_KEY, "1");
      return true;
    } catch {
      return true;
    }
  });
  const [index, setIndex] = useState(0);
  const trackRef = useRef(null);

  function dismiss(to) {
    setVisible(false);
    if (to) navigate(to);
  }

  function onScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.max(0, Math.min(CARDS.length - 1, i)));
  }

  function goTo(i) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  if (!visible) return null;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] overflow-y-auto bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="LOKIN AI feature tour"
    >
      {/* Skyline hero */}
      <div className="relative">
        <img src={LOKIN_SKYLINE_BG} alt="" draggable="false" className="h-56 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black" />
        <button
          type="button"
          onClick={() => dismiss("/")}
          aria-label="Skip tour"
          className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/70 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="absolute inset-x-0 bottom-3 text-center">
          <LokinWordmark size={30} className="justify-center" />
          <div className="lokin-kicker mt-1.5">UNLOCK YOUR POTENTIAL • LEVEL UP</div>
        </div>
      </div>

      <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="lokin-kicker text-center">MORE MILES · BRIGHTER FUTURES</div>

        {/* Swipeable cards */}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CARDS.map((card) => (
            <article key={card.title} className="lokin-card w-[78%] shrink-0 snap-center p-5">
              <card.icon className="h-8 w-8 text-primary" />
              <div className="mt-3 text-base font-black tracking-wide text-white">{card.title}</div>
              <div className="mt-1 text-xs font-bold tracking-[0.14em] text-primary">{card.desc}</div>
              <div className="mt-2 text-xs leading-relaxed text-white/55">{card.detail}</div>
              {card.soon && (
                <span className="mt-3 inline-block rounded-full border border-accent/40 px-2.5 py-1 text-[9px] font-bold tracking-[0.18em] text-accent">
                  COMING SOON
                </span>
              )}
            </article>
          ))}
        </div>

        {/* Dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {CARDS.map((card, i) => (
            <button
              key={card.title}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${card.title}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => dismiss("/onboarding")}
          className="lokin-cta mt-5 flex w-full items-center justify-center gap-2 text-lg"
        >
          GET STARTED <ArrowRight className="h-5 w-5" />
        </button>
        <div className="lokin-cta-caption mt-2 text-center">DRIVE • EARN • GROW • TOGETHER</div>
      </div>
    </motion.section>
  );
}
