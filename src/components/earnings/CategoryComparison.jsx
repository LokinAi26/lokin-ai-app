import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sessionCategoryLabel } from "@/lib/deliveryLabels";

// Category profitability: groups tagged delivery sessions (DriverSession
// records written at Tap Out) by category and ranks them by net $/hr so the
// driver can see which categories pay best over time.
export default function CategoryComparison() {
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    let on = true;
    base44.entities.DriverSession.filter({}, "-ended_at")
      .then((rows) => on && setSessions(rows || []))
      .catch(() => on && setSessions([]));
    return () => {
      on = false;
    };
  }, []);

  if (sessions === null) {
    return (
      <div className="lokin-card p-4">
        <div className="lokin-kicker lokin-kicker-lime mb-2 flex items-center gap-2"><Tag className="h-3.5 w-3.5" /> CATEGORY PROFITABILITY</div>
        <div className="py-2 text-xs text-white/45">Loading tagged sessions…</div>
      </div>
    );
  }

  const groups = {};
  for (const s of sessions) {
    if (s.status && s.status !== "ended") continue;
    const key = s.category || "mixed";
    const g = groups[key] || (groups[key] = { earnings: 0, miles: 0, hours: 0, count: 0 });
    g.count += 1;
    g.earnings += Number(s.earnings) || 0;
    g.miles += Number(s.miles) || 0;
    const start = s.started_at ? new Date(s.started_at).getTime() : null;
    const end = s.ended_at ? new Date(s.ended_at).getTime() : null;
    if (start && end && end > start) g.hours += (end - start) / 3600000;
  }

  const rows = Object.entries(groups)
    .map(([key, g]) => ({
      ...g,
      key,
      label: sessionCategoryLabel(key),
      perHour: g.hours > 0 ? g.earnings / g.hours : null,
    }))
    .sort((a, b) => (b.perHour ?? -1) - (a.perHour ?? -1) || b.earnings - a.earnings);

  const scaleMax = Math.max(0.01, ...rows.map((r) => r.perHour ?? r.earnings));

  return (
    <div className="lokin-card p-4">
      <div className="lokin-kicker lokin-kicker-lime mb-1 flex items-center gap-2"><Tag className="h-3.5 w-3.5" /> CATEGORY PROFITABILITY</div>
      <div className="text-[10px] text-white/40 mb-3">Net $/hr by session tag · all tagged delivery sessions, all time.</div>
      {rows.length === 0 ? (
        <div className="text-sm text-white/45">No tagged sessions yet — pick a category when you start work to see which pays best.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const pct = Math.min(100, Math.round(((r.perHour ?? r.earnings) / scaleMax) * 100));
            return (
              <div key={r.key}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-white/70">
                    {r.label}
                    <span className="text-white/35"> · {r.count} session{r.count === 1 ? "" : "s"}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-primary">
                    {r.perHour != null ? `$${r.perHour.toFixed(2)}/hr` : `$${r.earnings.toFixed(0)} total`}
                  </span>
                </div>
                <div className="lokin-progress-track mt-1 h-1.5">
                  <div className="lokin-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-0.5 text-[9px] text-white/35">
                  ${r.earnings.toFixed(0)} gross · {r.miles.toFixed(0)} mi{r.hours > 0 ? ` · ${r.hours.toFixed(1)} hrs` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}