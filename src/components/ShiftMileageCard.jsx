import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { DEDUCTION_RATE_PER_MILE, getShiftSnapshot, localDateString, subscribeShift } from "@/lib/shiftMileage";

// Home card: live shift mileage plus the day's total logged miles and the
// potential tax savings those miles represent at the deduction rate.
export default function ShiftMileageCard({ workStatus }) {
  const [shiftMiles, setShiftMiles] = useState(() => getShiftSnapshot().miles);
  const [loggedMiles, setLoggedMiles] = useState(null);
  const [loggedSavings, setLoggedSavings] = useState(0);

  useEffect(() => subscribeShift((snap) => setShiftMiles(snap.miles)), []);

  useEffect(() => {
    let alive = true;
    async function loadToday() {
      try {
        const rows = await base44.entities.MileageLog.filter({ date: localDateString() });
        if (alive) {
          setLoggedMiles(rows.reduce((sum, row) => sum + (Number(row.miles) || 0), 0));
          setLoggedSavings(rows.reduce((sum, row) => sum + (Number(row.deduction) || 0), 0));
        }
      } catch {
        if (alive) setLoggedMiles(0);
      }
    }
    loadToday();
    const unsubscribe = base44.entities.MileageLog.subscribe((event) => {
      if (event?.type === "create" || event?.type === "delete" || event?.type === "update") loadToday();
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const tracking = workStatus === "working" || workStatus === "paused";
  const total = (loggedMiles || 0) + (tracking ? shiftMiles : 0);

  return (
    <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-primary/20 lokin-panel lokin-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.06]">
        <Gauge className={`h-4 w-4 text-primary${tracking ? " animate-pulse" : ""}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] tracking-[0.18em] text-primary/80">AUTO MILEAGE · TODAY</div>
        <div className="mt-0.5 font-display text-xl font-black leading-none text-primary">
          {loggedMiles == null && !tracking ? <span className="inline-block h-5 w-16 rounded bg-white/10 animate-pulse" /> : `${total.toFixed(1)} MI`}
        </div>
      </div>
      <div className="shrink-0 text-right text-[10px] leading-tight">
        {tracking ? (
          <>
            <div className="font-bold text-primary">{shiftMiles.toFixed(1)} mi this shift</div>
            <div className="text-white/35">{workStatus === "working" ? "GPS tracking active" : "paused"}</div>
          </>
        ) : (
          <div className="text-white/35">per-shift GPS log</div>
        )}
      </div>
    </div>
  );
}