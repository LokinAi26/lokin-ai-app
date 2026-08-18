import { Sparkles } from "lucide-react";

export default function CommerceIntelligenceScore({ score }) {
  if (!score) return null;
  const { score: val = 0, grade = "—", breakdown = {} } = score;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(val) || 0));
  const offset = circ - (pct / 100) * circ;
  const rows = [
    ["Revenue", breakdown.revenue_health],
    ["Fulfillment", breakdown.fulfillment_health],
    ["Customer", breakdown.customer_health],
    ["Inventory", breakdown.inventory_health],
    ["Risk", breakdown.risk],
  ];
  return (
    <section className="rounded-3xl border border-primary/25 lokin-panel p-4">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.24em] text-primary/80 font-display mb-3">
        <Sparkles className="h-3.5 w-3.5" /> COMMERCE INTELLIGENCE SCORE · AI
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-32 h-32 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--primary) / 0.12)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s ease", filter: "drop-shadow(0 0 6px hsl(80 100% 50% / 0.6))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-primary font-display">{Math.round(pct)}</div>
            <div className="text-[10px] tracking-widest text-white/40">GRADE {grade}</div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {rows.map(([label, v]) => (
            <div key={label}>
              <div className="flex justify-between text-[9px] text-white/40 mb-0.5">
                <span>{label}</span>
                <span>{Math.round(Number(v || 0))}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, Number(v || 0)))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}