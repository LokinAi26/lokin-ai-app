import { ShoppingBag } from "lucide-react";
import { LokinGlyph, LokinWordmark } from "@/components/Brand";
import ApparelMockup from "@/components/ApparelMockup";
import { useToast } from "@/components/ui/use-toast";

const PALETTE = [
  { name: "Neon Lime", hex: "#A8FF00", text: "text-black" },
  { name: "Vault Black", hex: "#000000", text: "text-white" },
  { name: "Carbon", hex: "#0b0f14", text: "text-white" },
  { name: "Cyan Pulse", hex: "#00E5FF", text: "text-black" },
  { name: "Metal Silver", hex: "#c8ced8", text: "text-black" },
  { name: "Neon Red", hex: "#FF3B3B", text: "text-white" },
];

const TYPE = [
  { label: "Display", fam: "font-display", sample: "LOKIN", weight: "font-black tracking-widest" },
  { label: "Heading", fam: "font-heading", sample: "Lock In. Make More.", weight: "font-bold" },
  { label: "Body", fam: "font-body", sample: "Maximum earnings, every gig.", weight: "font-medium" },
];

const APPAREL = [
  { variant: "tee", name: "Vault Tee", price: "$32" },
  { variant: "hoodie", name: "Lock In Hoodie", price: "$58" },
  { variant: "cap", name: "Lokin Cap", price: "$28" },
  { variant: "sticker", name: "Glyph Sticker Pack", price: "$9" },
];

export default function Brand() {
  const { toast } = useToast();

  function notify(name) {
    toast({ title: "Added to waitlist", description: `We'll ping you when ${name} drops.` });
  }

  return (
    <div className="p-4 space-y-6 pb-8">
      <div>
        <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">BRAND SYSTEM</div>
        <h1 className="text-2xl font-bold font-heading metal-text">LOKIN AI</h1>
      </div>

      {/* Emblem hero */}
      <div className="relative rounded-3xl border border-white/10 lokin-panel radial-fade p-6 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 brand-grid opacity-20" />
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-primary/30 bg-black glow-primary">
          <LokinGlyph size={84} className="lokin-spin" />
        </div>
        <div className="relative mt-4"><LokinWordmark size={30} /></div>
        <div className="relative mt-2 text-[11px] tracking-[0.32em] text-primary/70 font-display">UNLOCK YOUR POTENTIAL · LEVEL UP</div>
      </div>

      {/* Lockups */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black p-5 flex items-center justify-center min-h-28">
          <LokinGlyph size={56} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-black p-5 flex items-center justify-center min-h-28">
          <LokinWordmark size={24} />
        </div>
      </div>

      {/* Color palette */}
      <div>
        <div className="text-sm font-semibold text-white/80 mb-2">Color System</div>
        <div className="grid grid-cols-3 gap-2">
          {PALETTE.map((c) => (
            <div key={c.name} className="rounded-xl overflow-hidden border border-white/10">
              <div className="h-12 flex items-center justify-center text-[10px] font-bold" style={{ background: c.hex, color: c.hex === "#000000" ? "#A8FF00" : undefined }}>
                <span className={c.text}>{c.hex}</span>
              </div>
              <div className="bg-black/60 text-[10px] text-white/55 py-1 text-center">{c.name}</div>
            </div>
          ))}
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

      {/* Apparel */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold text-white/80">Apparel</div>
          <div className="ml-auto text-[10px] tracking-widest text-accent/70 font-display">DROPPING SOON</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {APPAREL.map((a) => (
            <div key={a.variant} className="rounded-2xl border border-white/10 lokin-panel p-3">
              <div className="rounded-xl bg-black/50 border border-white/5 p-2">
                <ApparelMockup variant={a.variant} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{a.name}</div>
                  <div className="text-xs text-primary font-bold">{a.price}</div>
                </div>
                <button onClick={() => notify(a.name)} className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary active:scale-95 transition-transform">
                  Notify
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-[10px] tracking-[0.24em] text-white/30 pt-2">
        LOKIN AI BRAND SYSTEM · LOCK IN. MAKE MORE.
      </div>
    </div>
  );
}