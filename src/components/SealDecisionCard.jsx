import { BrainCircuit, Gauge, Navigation, Radar, RefreshCcw, ShieldCheck } from "lucide-react";

const ACTION_STYLE = {
  TAKE: "border-primary/40 bg-primary/[0.08] text-primary",
  CONSIDER: "border-amber-400/40 bg-amber-400/[0.08] text-amber-300",
  PASS: "border-red-400/40 bg-red-400/[0.08] text-red-300",
};

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : "—";
}

export default function SealDecisionCard({ seal, compact = false }) {
  const decision = seal?.top_decision;
  const counts = seal?.counts || {};
  if (!seal) return null;

  if (!decision) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white/75">
          <ShieldCheck className="h-4 w-4 text-primary" />
          LOKIN SEAL ACTIVE
        </div>
        <div className="mt-1 text-[11px] text-white/45">No current offer has enough verified data for a decision.</div>
      </div>
    );
  }

  const style = ACTION_STYLE[decision.action] || ACTION_STYLE.CONSIDER;
  const economics = decision.economics || {};
  const primaryReason = decision.advise?.reasons?.[0] || "Decision evaluated against your current goals.";
  const uncertainty = decision.advise?.uncertainty_codes?.[0];

  if (compact) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div className="text-[10px] font-display tracking-[0.18em] text-primary">LOKIN SEAL</div>
          <div className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-black ${style}`}>{decision.action}</div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-black font-display text-white">{decision.score}<span className="text-xs text-white/35">/100</span></div>
            <div className="text-[10px] text-white/45">{decision.confidence} confidence</div>
          </div>
          <div className="text-right text-[11px]">
            <div className="font-bold text-primary">{money(economics.projected_net_per_hour)}/hr net</div>
            <div className="text-white/45">{money(economics.projected_net_per_mile)}/mi</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] leading-relaxed text-white/65">{primaryReason}</div>
      </div>
    );
  }

  const stages = [
    { key: "S", label: "Sense", icon: Radar, value: decision.sense?.verification_status || "unverified" },
    { key: "E", label: "Evaluate", icon: Gauge, value: `${decision.score}/100` },
    { key: "A", label: "Advise", icon: Navigation, value: decision.action },
    { key: "L", label: "Learn", icon: RefreshCcw, value: "outcome ready" },
  ];

  return (
    <div className="rounded-3xl border border-primary/25 bg-primary/[0.045] p-4">
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-primary" />
        <div>
          <div className="text-[10px] font-display tracking-[0.2em] text-primary">LOKIN SEAL</div>
          <div className="text-sm font-bold text-white">Decision Intelligence</div>
        </div>
        <div className={`ml-auto rounded-full border px-3 py-1 text-xs font-black ${style}`}>{decision.action}</div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {stages.map(({ key, label, icon: Icon, value }) => (
          <div key={key} className="rounded-xl border border-white/8 bg-black/25 p-2 text-center">
            <Icon className="mx-auto h-3.5 w-3.5 text-primary" />
            <div className="mt-1 text-[9px] font-black text-white">{key} · {label}</div>
            <div className="mt-0.5 truncate text-[8px] uppercase text-white/35">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="SEAL score" value={`${decision.score}/100`} />
        <Metric label="Net/hour" value={money(economics.projected_net_per_hour)} accent />
        <Metric label="Net/mile" value={money(economics.projected_net_per_mile)} accent />
      </div>

      <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <div>
            <div className="text-xs text-white/80">{primaryReason}</div>
            <div className="mt-1 text-[10px] text-white/40">
              {decision.confidence} confidence · {decision.confidence_score}/100
              {uncertainty ? ` · Uncertainty: ${uncertainty.replaceAll("_", " ").toLowerCase()}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-white/40">
        <span>{counts.take || 0} take · {counts.consider || 0} consider · {counts.pass || 0} pass</span>
        <span>Driver confirmation required</span>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-2">
      <div className={`text-sm font-black ${accent ? "text-primary" : "text-white"}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-white/35">{label}</div>
    </div>
  );
}
