import { useState } from "react";
import { Banknote, Gauge, TrendingUp } from "lucide-react";
import SessionEfficiencyMap from "@/components/session/SessionEfficiencyMap";
import { sessionCategoryLabel } from "@/lib/deliveryLabels";

function fmtDuration(ms) {
  const mins = Math.round(Math.max(0, ms) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// End-of-session recap shown after Tap Out: total miles driven, earnings
// logged during the session, and the resulting hourly average.
export default function SessionSummaryModal({ summary, onClose, onFinalizeOdometer }) {
  const [odoEnd, setOdoEnd] = useState("");
  if (!summary) return null;

  const hours = summary.startedAt
    ? Math.max(0, (summary.endedAt - summary.startedAt) / 3600000)
    : null;
  const perHour = hours > 0 ? summary.earnings / hours : null;

  // Odometer reconciliation: when both readings are valid the odometer
  // difference is the authoritative mileage (IRS-grade).
  const odoStart = summary.odometerStart;
  const odoEndNum = Number(odoEnd);
  const odoValid = odoStart != null && odoEnd.trim() !== "" && Number.isFinite(odoEndNum) && odoEndNum >= odoStart;
  const displayMiles = odoValid ? odoEndNum - odoStart : summary.miles;

  function done() {
    if (odoValid && onFinalizeOdometer) {
      onFinalizeOdometer({ odometerEnd: odoEndNum, finalMiles: displayMiles });
    }
    onClose();
  }

  const rows = [
    { icon: Gauge, label: "MILES DRIVEN", value: `${displayMiles.toFixed(1)} mi` },
    { icon: Banknote, label: "EARNINGS MADE", value: `$${summary.earnings.toFixed(2)}` },
    { icon: TrendingUp, label: "HOURLY AVERAGE", value: perHour != null ? `$${perHour.toFixed(2)}/hr` : "—" },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5 lokin-scrim" onClick={done}>
      <div className="lokin-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="lokin-kicker lokin-kicker-lime text-center">SESSION COMPLETE</div>
        <div className="mt-1 text-center font-heading text-2xl font-black uppercase metal-text">Shift Recap</div>
        <div className="mt-1 text-center text-[11px] text-white/40">
          {summary.startedAt
            ? `${fmtDuration(summary.endedAt - summary.startedAt)} on the road`
            : "No GPS session recorded"}
        </div>
        {summary.category && (
          <div className="mt-2 text-center">
            <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              {sessionCategoryLabel(summary.category)}
            </span>
          </div>
        )}

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

        {summary.preTrip && summary.preTrip.total > 0 && (
          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-white/50">PRE-TRIP CHECK</span>
              <span className={`font-display font-black text-lg ${summary.preTrip.passed >= summary.preTrip.total ? "text-primary" : "text-white"}`}>
                {summary.preTrip.passed}/{summary.preTrip.total}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-white/40">
              {summary.preTrip.items.filter((i) => !i.ok).length === 0
                ? "All checks passed ✓"
                : `Needs attention: ${summary.preTrip.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`}
            </div>
          </div>
        )}

        <SessionEfficiencyMap
          actualPath={summary.path || []}
          optimizedGeometry={summary.optimizedRoute?.geometry || []}
          stops={summary.optimizedRoute?.stops || []}
          actualMiles={summary.miles}
        />

        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-white/50">ODOMETER</span>
            <span className="text-[10px] text-white/35">{summary.milesSource === "odometer" ? "odometer ✓" : "GPS"}{summary.gpsMiles != null && odoValid ? ` · GPS ${summary.gpsMiles.toFixed(1)}` : ""}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-white/35 mb-1">Start</div>
              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/60">{odoStart != null ? odoStart.toFixed(1) : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] text-white/35 mb-1">End</div>
              <input
                type="number" inputMode="decimal" min="0" step="0.1" value={odoEnd}
                onChange={(e) => setOdoEnd(e.target.value)}
                placeholder="End reading"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/60"
              />
            </div>
          </div>
          {odoEnd.trim() !== "" && !odoValid && (
            <div className="mt-1.5 text-[11px] text-amber-300/80">End reading must be at or above the start{odoStart == null ? " (no start reading was logged)" : ""}.</div>
          )}
        </div>

        <button onClick={done} className="lokin-cta w-full mt-5">
          DONE
        </button>
      </div>
    </div>
  );
}