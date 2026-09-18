import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, CalendarDays, Clock, Gauge, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PullToRefresh from "@/components/PullToRefresh";
import { DEDUCTION_RATE_PER_MILE, localDateString } from "@/lib/shiftMileage";
import { sessionCategoryLabel } from "@/lib/deliveryLabels";

const RANGES = [
  { value: "week", label: "This Week", days: 7 },
  { value: "month", label: "This Month", days: 30 },
  { value: "all", label: "All Time", days: 3650 },
];

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function shiftHours(s) {
  if (!s.started_at || !s.ended_at) return 0;
  return Math.max(0, (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000);
}

// Full shift summary report: every logged shift with miles, hours, earnings,
// $/mile and $/hour — plus period totals and the IRS mileage deduction estimate.
// Sessions are written automatically on Tap Out; earnings come from manual
// entries and screenshot scans recorded during the shift window.
export default function ShiftReport() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [range, setRange] = useState("week");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        base44.entities.DriverSession.filter({}, "-started_at", 200),
        base44.entities.Earning.filter({}, "-date", 500),
      ]);
      setSessions(Array.isArray(s) ? s : []);
      setEarnings(Array.isArray(e) ? e : []);
    } catch {
      /* keep last data */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const days = RANGES.find((r) => r.value === range)?.days || 7;
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return localDateString(d);
  }, [days]);

  const filtered = useMemo(
    () => sessions.filter((s) => (s.started_at || "").slice(0, 10) >= cutoff),
    [sessions, cutoff]
  );

  const totals = useMemo(() => {
    let miles = 0, earn = 0, hours = 0;
    for (const s of filtered) {
      miles += Number(s.miles) || 0;
      earn += Number(s.earnings) || 0;
      hours += shiftHours(s);
    }
    return {
      miles,
      earn,
      hours,
      perMile: miles > 0 ? earn / miles : 0,
      perHour: hours > 0 ? earn / hours : 0,
      deduction: miles * DEDUCTION_RATE_PER_MILE,
      count: filtered.length,
    };
  }, [filtered]);

  // Earnings in range grouped by platform (from Earning records, independent
  // of the per-shift rollups, so scanned + manual entries both count).
  const byPlatform = useMemo(() => {
    const m = {};
    for (const r of earnings) {
      if ((r.date || "") < cutoff) continue;
      const k = r.platform || "Other";
      m[k] = (m[k] || 0) + (Number(r.amount) || 0);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [earnings, cutoff]);

  const statTiles = [
    { icon: Gauge, label: "Miles", value: totals.miles.toFixed(1) },
    { icon: Clock, label: "Hours", value: totals.hours.toFixed(1) },
    { icon: Banknote, label: "Earnings", value: `$${totals.earn.toFixed(0)}` },
    { icon: TrendingUp, label: "$ / mile", value: `$${totals.perMile.toFixed(2)}` },
    { icon: TrendingUp, label: "$ / hour", value: `$${totals.perHour.toFixed(2)}` },
    { icon: CalendarDays, label: "Shifts", value: `${totals.count}` },
  ];

  return (
    <PullToRefresh onRefresh={load}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-white/10" aria-label="Back">
            <ArrowLeft className="h-4 w-4 text-white/60" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-heading metal-text">Shift Report</h1>
            <p className="text-sm text-white/45">Automatic mileage + earnings log.</p>
          </div>
        </div>

        <div className="flex rounded-2xl border border-lokin-neon/20 bg-white/[0.03] p-1 text-sm">
          {RANGES.map((r) => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`flex-1 rounded-xl py-1.5 font-medium transition-colors ${range === r.value ? "bg-lokin-lime font-bold text-black" : "text-lokin-dim"}`}>
              {r.label}
            </button>
          ))}
        </div>

        {loading && sessions.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <div className="text-sm font-bold text-white">No shifts logged yet</div>
            <div className="mt-1 text-xs text-white/45 max-w-[30ch] mx-auto">
              Hit START WORK and LOKIN tracks your miles automatically. Tap out to close the shift.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {statTiles.map((s) => (
                <div key={s.label} className="lokin-stat-tile">
                  <s.icon className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <div className="lokin-stat-value text-lg font-display">{s.value}</div>
                  <div className="text-[10px] text-white/40">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] tracking-[0.18em] text-white/45 font-display">EST. TAX DEDUCTION</div>
                <div className="text-[11px] text-white/40 mt-0.5">{totals.miles.toFixed(1)} mi × ${DEDUCTION_RATE_PER_MILE.toFixed(2)}/mi IRS rate</div>
              </div>
              <div className="font-display font-black text-2xl text-primary">${totals.deduction.toFixed(0)}</div>
            </div>

            {byPlatform.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] tracking-[0.18em] text-white/45 font-display mb-2">PER APP</div>
                <div className="space-y-1.5">
                  {byPlatform.map(([p, v]) => (
                    <div key={p} className="flex items-center justify-between text-sm">
                      <span className="text-white/70">{p}</span>
                      <span className="font-bold text-white">${v.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[10px] tracking-[0.18em] text-white/45 font-display">SHIFTS</div>
              {filtered.map((s) => {
                const h = shiftHours(s);
                const mi = Number(s.miles) || 0;
                const er = Number(s.earnings) || 0;
                return (
                  <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-white">{fmtDate(s.started_at)}</div>
                      {s.category && (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
                          {sessionCategoryLabel(s.category)}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {fmtTime(s.started_at)} – {fmtTime(s.ended_at)} · {h.toFixed(1)}h
                      {s.miles_source === "odometer" ? " · odometer ✓" : ""}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                      <div><div className="text-sm font-black text-primary">{mi.toFixed(1)}</div><div className="text-[10px] text-white/35">mi</div></div>
                      <div><div className="text-sm font-black text-white">${er.toFixed(0)}</div><div className="text-[10px] text-white/35">earned</div></div>
                      <div><div className="text-sm font-black text-white">${mi > 0 ? (er / mi).toFixed(2) : "—"}</div><div className="text-[10px] text-white/35">$/mi</div></div>
                      <div><div className="text-sm font-black text-white">${h > 0 ? (er / h).toFixed(2) : "—"}</div><div className="text-[10px] text-white/35">$/hr</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
