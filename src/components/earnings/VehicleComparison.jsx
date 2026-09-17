import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Bike } from "lucide-react";
import { VEHICLES, vehicleLabel } from "@/lib/vehicleTags";

const HOURS_PER_TRIP = 0.4; // same hours estimate as the Earnings page
const COLOR_BY_VEHICLE = {
  car: "#8FE44E",
  motorcycle: "#22D3EE",
  cargo_van: "#C8FF3D",
  box_truck: "#FF8A00",
  other: "#9B5DE5",
  unlabeled: "#6E7A6E",
};

// Per-vehicle $/hr comparison, so the driver can see whether e.g. their
// motorcycle or car is earning more per hour.
export default function VehicleComparison({ records = [] }) {
  const rows = useMemo(() => {
    const acc = new Map();
    records.forEach((r) => {
      if (r.amount == null) return;
      const key = VEHICLES.some((v) => v.value === r.vehicle) ? r.vehicle : "unlabeled";
      const a = acc.get(key) || { key, earnings: 0, hours: 0, records: 0 };
      a.earnings += r.amount || 0;
      a.hours += Math.max(1, r.trips || 0) * HOURS_PER_TRIP;
      a.records += 1;
      acc.set(key, a);
    });
    return [...acc.values()]
      .map((a) => ({
        ...a,
        label: a.key === "unlabeled" ? "Unlabeled" : vehicleLabel(a.key),
        perHour: a.hours > 0 ? Math.round((a.earnings / a.hours) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.perHour - a.perHour);
  }, [records]);

  const onlyUnlabeled = rows.length === 1 && rows[0].key === "unlabeled";
  const best = rows[0];

  return (
    <div className="lokin-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bike className="h-4 w-4 text-primary" />
        <div className="lokin-kicker lokin-kicker-lime">VEHICLE COMPARISON · $/HR</div>
        <div className="ml-auto text-[10px] text-white/40">per logged vehicle</div>
      </div>

      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-white/45">Log earnings to compare vehicle earnings per hour.</div>
      ) : (
        <>
          {best && best.key !== "unlabeled" && (
            <div className="mb-2 text-xs text-white/55">
              Top earner: <span className="font-bold text-primary">{best.label}</span> at{" "}
              <span className="font-bold text-primary">${best.perHour.toFixed(2)}/hr</span>
            </div>
          )}

          <div className="h-48 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  cursor={{ fill: "hsl(0 0% 100% / 0.05)" }}
                  contentStyle={{ borderRadius: 12, background: "#0a0a0a", border: "1px solid hsl(0 0% 100% / 0.12)", fontSize: 12, color: "#fff" }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}/hr`, "Avg"]}
                />
                <Bar dataKey="perHour" radius={[4, 4, 0, 0]}>
                  {rows.map((r) => (
                    <Cell key={r.key} fill={COLOR_BY_VEHICLE[r.key] || "#8FE44E"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-1.5">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR_BY_VEHICLE[r.key], boxShadow: `0 0 8px ${COLOR_BY_VEHICLE[r.key]}` }} />
                  <span className="truncate text-xs font-semibold text-white/80">{r.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-[11px]">
                  <span className="font-semibold text-white/85">${r.earnings.toFixed(0)}</span>
                  <span className="text-primary font-semibold">${r.perHour.toFixed(2)}/hr</span>
                </span>
              </div>
            ))}
            {onlyUnlabeled && (
              <div className="py-2 text-center text-[11px] text-white/45">Tag logged earnings with a vehicle (Tax → Log income) to compare vehicles.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}