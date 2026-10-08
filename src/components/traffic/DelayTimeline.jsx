// Timeline view (2026-10-08): every recorded traffic delay laid out day by
// day on a vertical rail, so recurring slowdowns on the driver's daily routes
// stand out. Areas reported 2+ times get a RECURRING chip; repeat days for
// the same area are tinted, making "this corridor burns me every afternoon"
// visible at a glance.
import { CalendarDays, Repeat, Trash2 } from "lucide-react";
import { DAY_PART_LABELS } from "@/lib/trafficDelayLog";

function dayKey(item) {
  const t = item.reported_at || item.created_date;
  return new Date(t).toISOString().slice(0, 10);
}

function dayLabel(key) {
  const d = new Date(`${key}T12:00:00`);
  const today = new Date().toISOString().slice(0, 10);
  if (key === today) return "Today";
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (key === yesterday) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function timeLabel(item) {
  return new Date(item.reported_at || item.created_date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function severity(minutes) {
  const m = Number(minutes) || 0;
  if (m >= 20) return "#FF2D2D"; // red — heavy delay
  if (m >= 10) return "#FFB020"; // amber — moderate
  return "#7CFC1E"; // lime — light
}

export default function DelayTimeline({ items, onRemove }) {
  // Recurring = same area reported 2+ times across the whole log.
  const countsByArea = new Map();
  for (const i of items) {
    const key = String(i.area || "").toLowerCase().trim();
    if (key) countsByArea.set(key, (countsByArea.get(key) || 0) + 1);
  }

  // Group by day, newest day first, entries within a day newest first.
  const days = [];
  const byDay = new Map();
  for (const i of items) {
    const key = dayKey(i);
    if (!byDay.has(key)) {
      byDay.set(key, []);
      days.push(key);
    }
    byDay.get(key).push(i);
  }
  days.sort((a, b) => (a < b ? 1 : -1));
  for (const key of days) byDay.get(key).sort((a, b) => new Date(b.reported_at || b.created_date) - new Date(a.reported_at || a.created_date));

  if (!days.length) {
    return <div className="text-sm text-white/45 text-center py-6">No delays logged yet. LOKIN records them as you drive — check back after a shift.</div>;
  }

  let dayTotalMinutes = 0;
  return (
    <div className="space-y-4">
      {days.map((key) => {
        const entries = byDay.get(key);
        const dayMinutes = entries.reduce((s, e) => s + (Number(e.delay_minutes) || 0), 0);
        dayTotalMinutes += dayMinutes;
        return (
          <div key={key} className="rounded-2xl border border-white/10 lokin-panel lokin-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-white/70 font-display uppercase">
                <CalendarDays className="h-3.5 w-3.5 text-primary" /> {dayLabel(key)}
              </div>
              <span className="text-[10px] font-bold text-white/45">{entries.length} report{entries.length === 1 ? "" : "s"} · {dayMinutes}m lost</span>
            </div>

            <div className="mt-3 relative pl-4">
              {/* Vertical rail */}
              <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-primary/25" />
              {entries.map((i) => {
                const count = countsByArea.get(String(i.area || "").toLowerCase().trim()) || 0;
                const recurring = count >= 2;
                return (
                  <div key={i.id} className="relative mb-3 last:mb-0">
                    <span
                      aria-hidden
                      className="absolute -left-4 top-2.5 h-2.5 w-2.5 rounded-full"
                      style={{ background: severity(i.delay_minutes), boxShadow: `0 0 8px ${severity(i.delay_minutes)}` }}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-white/35 tabular-nums">{timeLabel(i)}</span>
                          <span className="text-sm text-white truncate">{i.area}</span>
                          {recurring && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.06em] text-amber-200">
                              <Repeat className="h-2.5 w-2.5" /> RECURRING ×{count}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40">
                          {DAY_PART_LABELS[i.day_part] || i.day_part} · {i.source === "voice_report" ? "voice report" : "auto warning"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold text-destructive">{Math.round(Number(i.delay_minutes) || 0)}m</span>
                        <button onClick={() => onRemove(i.id)} className="text-destructive p-1" aria-label="Delete entry">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="text-[9px] text-white/30 text-center">All {items.length} logged delay reports · {dayTotalMinutes} minutes total</div>
    </div>
  );
}