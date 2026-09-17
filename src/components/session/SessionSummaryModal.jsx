import { Banknote, Gauge, TrendingUp } from "lucide-react";
import SessionEfficiencyMap from "@/components/session/SessionEfficiencyMap";

function fmtDuration(ms) {
  const mins = Math.round(Math.max(0, ms) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// End-of-session recap shown after Tap Out: total miles driven, earnings
// logged during the session, and the resulting hourly average.
export default function SessionSummaryModal({ summary, onClose }) {
  if (!summary) return null;

  const hours = summary.startedAt
    ? Math.max(0, (summary.endedAt - summary.startedAt) / 3600000)
    : null;
  const perHour = hours > 0 ? summary.earnings / hours : null;

  const rows = [
    { icon: Gauge, label: "MILES DRIVEN", value: `${summary.miles.toFixed(1)} mi` },
    { icon: Banknote, label: "EARNINGS MADE", value: `$${summary.earnings.toFixed(2)}` },
    { icon: TrendingUp, label: "HOURLY AVERAGE", value: perHour != null ? `$${perHour.toFixed(2)}/hr` : "—" },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5 lokin-scrim" onClick={onClose}>
      <div className="lokin-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="lokin-kicker lokin-kicker-lime text-center">SESSION COMPLETE</div>
        <div className="mt-1 text-center font-heading text-2xl font-black uppercase metal-text">Shift Recap</div>
        <div className="mt-1 text-center text-[11px] text-white/40">
          {summary.startedAt
            ? `${fmtDuration(summary.endedAt - summary.startedAt)} on the road`
            : "No GPS session recorded"}
        </div>

        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-white/50">
                <r.icon className="h-4 w-4 text-primary" /> {r.label}
              </span>
              <span className="font-display font-black text-lg text-primary">{r.value}</span>
            </div>
          ))}
        </div>

        <SessionEfficiencyMap
          actualPath={summary.path || []}
          optimizedGeometry={summary.optimizedRoute?.geometry || []}
          stops={summary.optimizedRoute?.stops || []}
          actualMiles={summary.miles}
        />

        <button onClick={onClose} className="lokin-cta w-full mt-5">
          DONE
        </button>
      </div>
    </div>
  );
}