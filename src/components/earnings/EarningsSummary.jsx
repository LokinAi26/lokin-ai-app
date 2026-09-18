import { Gauge, Trophy } from "lucide-react";

// Earnings performance summary: average delivery speed (mph, derived with the
// same trips → hours estimate the Earnings page uses) and per-hour earnings
// broken down by delivery type (platform).
export default function EarningsSummary({ records }) {
  if (!records || records.length === 0) return null;

  const miles = records.reduce((s, r) => s + (r.miles || 0), 0);
  const trips = records.reduce((s, r) => s + (r.trips || 0), 0);
  const hours = trips * 0.4;
  const avgSpeed = hours > 0 ? miles / hours : 0;

  const byType = Object.values(
    records.reduce((acc, r) => {
      const type = r.platform || "mixed";
      if (!acc[type]) acc[type] = { type, amount: 0, trips: 0 };
      acc[type].amount += r.amount || 0;
      acc[type].trips += r.trips || 0;
      return acc;
    }, {})
  )
    .map((t) => ({ ...t, perHour: t.trips > 0 ? t.amount / (t.trips * 0.4) : 0 }))
    .sort((a, b) => b.perHour - a.perHour);
  const best = byType[0];

  return (
    <div className="lokin-card p-4">
      <div className="lokin-kicker lokin-kicker-lime mb-2 flex items-center gap-2">
        <Gauge className="h-4 w-4" /> Performance Summary
      </div>

      <div className="flex items-baseline gap-2">
        <span className="lokin-hero-number font-display text-3xl leading-none">{avgSpeed.toFixed(1)}</span>
        <span className="text-xs text-white/45">mph avg delivery speed · {trips} trips · {miles.toFixed(0)} mi</span>
      </div>

      {best && best.perHour > 0 && (
        <div className="mt-2 text-xs text-white/55">
          <Trophy className="mr-1 inline h-3.5 w-3.5 text-primary" />
          Best earner: <span className="font-bold capitalize text-primary">{best.type}</span> at ${best.perHour.toFixed(0)}/hr
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Earnings per hour by delivery type</div>
        {byType.map((t, i) => (
          <div
            key={t.type}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 ${i === 0 && t.perHour > 0 ? "border-primary/35 bg-primary/[0.06]" : "border-white/8 bg-black/20"}`}
          >
            <span className="text-sm font-semibold capitalize text-white/85">{t.type}</span>
            <span className={`text-sm font-bold ${i === 0 && t.perHour > 0 ? "text-primary" : "text-white/75"}`}>
              {t.perHour > 0 ? `$${t.perHour.toFixed(0)}/hr` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}