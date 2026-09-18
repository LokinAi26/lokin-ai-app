import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Clock } from "lucide-react";

const ESTIMATED_MINUTES_PER_TRIP = 24; // matches the app's trips × 0.4h heuristic
const DEFAULT_BAR = "#8FE44E";
const PEAK_BAR = "#C8FF3D";

function hourShort(h) {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function hourLong(h) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function hourOf(record) {
  const ts = record?.created_date;
  if (!ts) return null;
  const h = new Date(ts).getHours();
  return Number.isFinite(h) ? h : null;
}

// Average $/hr by hour of day across all logged earnings, so the driver can
// see which time slots are the most profitable to work.
export default function HourlyProfitability({ records = [] }) {
  const slots = useMemo(() => {
    const acc = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourShort(h), earnings: 0, hours: 0 }));
    records.forEach((r) => {
      const h = hourOf(r);
      if (h == null || r.amount == null) return;
      acc[h].earnings += r.amount || 0;
      // Estimated driving time: each record counts as at least one trip.
      acc[h].hours += Math.max(1, r.trips || 0) * (ESTIMATED_MINUTES_PER_TRIP / 60);
    });
    return acc.map((s) => ({
      ...s,
      perHour: s.hours > 0 ? Math.round((s.earnings / s.hours) * 100) / 100 : null,
    }));
  }, [records]);

  const timed = slots.filter((s) => s.perHour != null);
  const peak = timed.reduce((best, s) => (!best || s.perHour > best.perHour ? s : best), null);

  if (timed.length === 0) {
    return (
      <div className="lokin-card p-4">
        <div className="lokin-kicker lokin-kicker-lime mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4" /> AVG $/HR BY HOUR OF DAY
        </div>
        <div className="py-4 text-center text-xs text-white/45">Log earnings to see which hours of the day pay best.</div>
      </div>
    );
  }

  return (
    <div className="lokin-card p-4">
      <div className="lokin-kicker lokin-kicker-lime mb-1 flex items-center gap-2">
        <Clock className="h-4 w-4" /> AVG $/HR BY HOUR OF DAY
      </div>
      {peak && (
        <div className="mb-2 text-xs text-white/55">
          Best slot: <span className="font-bold text-primary">{hourLong(peak.hour)}</span> at{" "}
          <span className="font-bold text-primary">${peak.perHour.toFixed(2)}/hr</span> average
        </div>
      )}
      <div className="h-48 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={slots} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.45)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              cursor={{ fill: "hsl(0 0% 100% / 0.05)" }}
              contentStyle={{ borderRadius: 12, background: "#0a0a0a", border: "1px solid hsl(0 0% 100% / 0.12)", fontSize: 12, color: "#fff" }}
              formatter={(v) => (v == null ? ["no data", "Avg"] : [`$${Number(v).toFixed(2)}/hr`, "Avg"])}
              labelFormatter={(label, payload) => {
                const h = payload?.[0]?.payload?.hour;
                return h == null ? label : hourLong(h);
              }}
            />
            <Bar dataKey="perHour" radius={[3, 3, 0, 0]}>
              {slots.map((s) => (
                <Cell
                  key={s.hour}
                  fill={peak && s.hour === peak.hour ? PEAK_BAR : DEFAULT_BAR}
                  fillOpacity={s.perHour == null ? 0 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}