import { Route, TrendingUp, Fuel, Truck, ShieldAlert, Coffee, Sparkles, ArrowUpRight } from "lucide-react";
import { LokinGlyph, LokinWordmark } from "@/components/Brand";
import PrintfulStore from "@/components/PrintfulStore";
import GearShowcase from "@/components/GearShowcase";
import CommerceConnections from "@/components/CommerceConnections";
import CommerceOps from "@/components/CommerceOps";
import CommerceCommandCenter from "@/components/CommerceCommandCenter";

const PALETTE = [
  { name: "LOKIN Neon Lime™", hex: "#AAFF00", text: "text-black" },
  { name: "Vault Black", hex: "#000000", text: "text-white" },
  { name: "Carbon", hex: "#0b0f14", text: "text-white" },
  { name: "LOKIN AI Cyan™", hex: "#06D9F9", text: "text-black" },
  { name: "Metal Silver", hex: "#c8ced8", text: "text-black" },
  { name: "Neon Red", hex: "#FF3B3B", text: "text-white" },
];

const TYPE = [
  { label: "Display", fam: "font-display", sample: "LOKIN", weight: "font-black tracking-widest" },
  { label: "Heading", fam: "font-heading", sample: "LOCK IN. LEVEL UP.", weight: "font-bold" },
  { label: "Body", fam: "font-body", sample: "Drive safer. Work smarter. Live simpler.", weight: "font-medium" },
];

// What LOKIN stands for — base44-style value grid.
const VALUES = [
  { icon: Route, title: "Route AI", desc: "Sequenced by mode for max $/hr. Not the shortest path — the most profitable one." },
  { icon: TrendingUp, title: "Earnings OS", desc: "Live net-per-hour, goal tracking, and a Lock In Score that grades your shift." },
  { icon: Fuel, title: "Fuel Deals", desc: "Weekly discount codes and cashback so every gallon pays you back." },
  { icon: Truck, title: "On The Road", desc: "Truck stops, weigh stations, rest areas and RV parks — found along your route." },
  { icon: ShieldAlert, title: "Safety Net", desc: "SOS, live location sharing, and a fake-call scheduler for tough spots." },
  { icon: Coffee, title: "Break Recharge", desc: "Breathing coach, motivation pep talks, and free streaming between shifts." },
];

// Your Printful store ID (numeric). Find it in Printful → Store Settings.
// Leave empty to show the "Connect Printful" state; set it to pull live products & prices.
const PRINTFUL_STORE_ID = "";

export default function Brand() {
  return (
    <div className="p-4 space-y-6 pb-8">
      <div>
        <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">BRAND SYSTEM</div>
        <h1 className="text-2xl font-bold font-heading metal-text">Lock in. Level up</h1>
      </div>

      {/* Manifesto hero */}
      <div className="relative rounded-3xl border border-primary/25 lokin-panel radial-fade p-6 overflow-hidden">
        <div className="absolute inset-0 brand-grid opacity-20" />
        <div className="relative">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border border-primary/30 bg-black glow-primary">
            <LokinGlyph size={72} className="lokin-pulse" />
          </div>
          <h2 className="mt-5 font-display text-3xl font-black leading-[1.05] tracking-tight text-white">
            EVERY DRIVER<br /><span className="text-primary text-glow">NEEDS A LOCK.</span>
          </h2>
          <p className="mt-3 text-sm text-white/60 leading-relaxed max-w-prose">
            LOKIN AI is an intelligent driver operating system built to make life on the road safer, smarter, and simpler —
            a hands-free Co-Pilot that helps every mile, every gig, and every break work around the driver.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["One app", "Every mile", "Every driver", "Every trip"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/70">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* The whole stack value grid */}
      <div>
        <div className="text-[11px] tracking-[0.24em] text-white/40 font-display mb-2">THE WHOLE STACK · NO TAB JUGGLING</div>
        <div className="grid grid-cols-2 gap-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border border-white/10 lokin-panel p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 mb-3">
                <v.icon className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
              </div>
              <div className="text-sm font-bold text-white">{v.title}</div>
              <div className="text-xs text-white/50 mt-1 leading-relaxed">{v.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Brand identity */}
      <div>
        <div className="text-sm font-semibold text-white/80 mb-2">Brand Identity</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black p-5 flex flex-col items-center justify-center gap-2 min-h-32">
            <LokinGlyph size={52} />
            <span className="text-[10px] tracking-widest text-white/40 font-display">GLYPH</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black p-5 flex flex-col items-center justify-center gap-2 min-h-32">
            <LokinWordmark size={22} />
            <span className="text-[10px] tracking-widest text-white/40 font-display">LOCKUP</span>
          </div>
        </div>
      </div>

      {/* Color palette */}
      <div>
        <div className="text-sm font-semibold text-white/80 mb-2">Color System</div>
        <div className="grid grid-cols-3 gap-2">
          {PALETTE.map((c) => (
            <div key={c.name} className="rounded-xl overflow-hidden border border-white/10">
              <div className="h-12 flex items-center justify-center text-[10px] font-bold" style={{ background: c.hex, color: c.hex === "#000000" ? "#AAFF00" : undefined }}>
                <span className={c.text}>{c.hex}</span>
              </div>
              <div className="bg-black/60 text-[10px] text-white/55 py-1 text-center">{c.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Master identity rule */}
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-4">
        <div className="text-[11px] tracking-[0.22em] text-primary font-display">LOKIN MASTER IDENTITY · V1</div>
        <div className="mt-2 text-sm font-bold text-white">Protect the identity. Keep creativity open.</div>
        <p className="mt-1 text-xs leading-relaxed text-white/55">
          Neon Lime is the LOKIN identity/action signal. Black and graphite form the environment. AI Cyan is reserved for intelligence and data. White/silver carries information. Red is reserved for safety, destructive actions, and exceptions.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl border border-white/10 bg-black/50 p-2"><span className="text-primary font-bold">NEON LIME</span><div className="text-white/40 mt-0.5">Identity · action · route · active</div></div>
          <div className="rounded-xl border border-white/10 bg-black/50 p-2"><span className="text-accent font-bold">AI CYAN</span><div className="text-white/40 mt-0.5">AI · analysis · scanning · data</div></div>
          <div className="rounded-xl border border-white/10 bg-black/50 p-2"><span className="text-white font-bold">GRAPHITE / SILVER</span><div className="text-white/40 mt-0.5">Environment · information</div></div>
          <div className="rounded-xl border border-red-500/20 bg-black/50 p-2"><span className="text-red-400 font-bold">RED</span><div className="text-white/40 mt-0.5">Safety · Tap Out · exception only</div></div>
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/50 p-3 text-[10px] leading-relaxed text-white/45">
          Master colors stay fixed. Opacity, glow, gradients, motion, dimensional effects, layouts and future visual treatments remain open to creative evolution.
        </div>
      </div>

      {/* Typography */}
      <div>
        <div className="text-sm font-semibold text-white/80 mb-2">Typography</div>
        <div className="space-y-2">
          {TYPE.map((t) => (
            <div key={t.label} className="rounded-2xl border border-white/10 lokin-panel p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">{t.label}</div>
              <div className={`${t.fam} ${t.weight} text-lg text-white`}>{t.sample}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Commerce health — live status for Printful, Printify, Shopify and Gmail */}
      <CommerceConnections />

      {/* Order intelligence — Shopify payment signal → Printful fulfillment/tracking */}
      <CommerceOps />

      {/* Admin-only post-purchase intelligence — Shopify order and fulfillment pulse */}
      <CommerceCommandCenter />

      {/* In-app LOKIN gear collection — every card represents an individual sellable product */}
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
        <div className="text-[11px] tracking-[0.22em] text-primary/80 font-display">PRINT-ON-DEMAND READY</div>
        <div className="mt-1 text-sm font-bold text-white">Individual Product Catalog</div>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          Each item below is separated as its own product so artwork, mockups, variants, pricing, and fulfillment can be managed independently in Printful or Printify.
        </p>
      </div>
      <GearShowcase />

      {/* Live Printful store — auto-resolves store ID & pulls every product/price */}
      <PrintfulStore storeId={PRINTFUL_STORE_ID} limit={200} />

      {/* Built on base44 stamp */}
      <a href="https://base44.com" target="_blank" rel="noopener noreferrer"
        className="block rounded-2xl border border-white/10 bg-white/[0.02] p-4 active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Built on Base44</div>
            <div className="text-xs text-white/45">Vibe-coded. Every mile.</div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-white/40" />
        </div>
      </a>

      <div className="text-center text-[10px] tracking-[0.24em] text-white/30 pt-2">
        LOKIN AI BRAND SYSTEM · LOCK IN. LEVEL UP.
      </div>
    </div>
  );
}