import { useMemo } from "react";

function dayKey(d) { return d.toISOString().slice(0, 10); }

// Weekly earnings rolled up by order type (food, grocery, package, …).
// Grocery groups shop-and-deliver + pickup; trips and miles come along
// so each row is a real earning-rate snapshot, not just a dollar figure.
const ROWS = [
  { key: "food_pickup", label: "Food" },
  { key: "grocery", label: "Grocery", match: ["grocery_shop_deliver", "grocery_pickup"] },
  { key: "package", label: "Package" },
  { key: "retail", label: "Retail" },
  { key: "alcohol", label: "Alcohol" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "mixed", label: "Mixed" },
];

export default function WeeklyCategorySummary({ records }) {
  const week = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 6);
    const ck = dayKey(cutoff);
    const rows = (records || []).filter((r) => r.date >= ck);
    return ROWS.map(({ key, label, match }) => {
      const matched = rows.filter((r) => (match ? match.includes(r.category) : (r.category || "mixed") === key));
      return {
        key,
        label,
        amount: matched.reduce((s, r) => s + (r.amount || 0), 0),
        trips: matched.reduce((s, r) => s + (r.trips || 0), 0),
      };
    }).filter((r) => r.amount > 0);
  }, [records]);

  const total = week.reduce((s, r) => s + r.amount, 0);
  if (total <= 0) {
    return (
      <div className="lokin-card p-4">
        <div className="lokin-kicker mb-2">Weekly by order type</div>
        <p className="text-sm text-white/45">No earnings logged in the last 7 days.</p>
      </div>
    );
  }

  return (
    <div className="lokin-card p-4">
      <div className="lokin-kicker mb-2">Weekly by order type</div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm text-white/45">Last 7 days total</span>
        <span className="lokin-hero-number text-2xl font-display">${total.toFixed(2)}</span>
      </div>
      <div className="space-y-2.5">
        {week.map((r) => {
          const pct = Math.round((r.amount / total) * 100);
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70">{r.label}{r.trips > 0 && <span className="ml-1.5 text-[11px] text-white/40">{r.trips} trips</span>}</span>
                <span className="font-semibold text-primary">${r.amount.toFixed(2)} <span className="text-[11px] text-white/40">{pct}%</span></span>
              </div>
              <div className="lokin-progress-track mt-1 h-1.5">
                <div className="lokin-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}