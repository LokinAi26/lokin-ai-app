import { useMemo } from "react";
import { Clock, Flame } from "lucide-react";
import { TIME_BLOCKS, blockPerHour, heatColor } from "@/lib/heatData";

// Shift-planning heat grid: estimated $/hr per zone across the day's time
// blocks, so the driver can see the best times to drive in each area.
export default function TimeHeatGrid({ zones = [], onFocus }) {
  const rows = useMemo(() => zones.map((zone) => {
    const cells = TIME_BLOCKS.map((b) => ({ ...b, value: blockPerHour(zone, b.id) }));
    const best = cells.reduce((a, c) => (c.value > a.value ? c : a), cells[0]);
    return { zone, cells, best };
  }), [zones]);

  const overall = useMemo(() => {
    let top = null;
    rows.forEach((r) => r.cells.forEach((c) => {
      if (!top || c.value > top.value) top = { ...c, zone: r.zone };
    }));
    return top;
  }, [rows]);

  if (zones.length === 0) return null;

  return (
    <div className="lokin-card p-4">
      <div className="lokin-kicker lokin-kicker-lime mb-2 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> BEST TIMES TO DRIVE
      </div>

      {overall && (
        <div className="mb-3 text-xs text-white/55">
          <Flame className="mr-1 inline h-3.5 w-3.5 text-primary" />
          Peak window: <b className="text-white">{overall.zone.name}</b> · {overall.label} at <b className="text-primary">${overall.value.toFixed(0)}/hr</b>
        </div>
      )}

      <div className="-mx-1 overflow-x-auto no-scrollbar">
        <div className="min-w-[430px]">
          {/* Header: blank zone column + one column per time block */}
          <div
            className="grid items-center gap-[4px]"
            style={{ gridTemplateColumns: `minmax(96px, 1.2fr) repeat(${TIME_BLOCKS.length}, minmax(56px, 1fr))` }}
          >
            <div className="text-[9px] font-semibold uppercase tracking-widest text-white/40">Zone</div>
            {TIME_BLOCKS.map((b) => (
              <div key={b.id} className="truncate text-center text-[9px] font-bold uppercase tracking-wide text-white/45">{b.label}</div>
            ))}
          </div>

          <div className="mt-1.5 space-y-[4px]">
            {rows.map((row) => (
              <div
                key={row.zone.id}
                className="grid items-center gap-[4px]"
                style={{ gridTemplateColumns: `minmax(96px, 1.2fr) repeat(${TIME_BLOCKS.length}, minmax(56px, 1fr))` }}
              >
                <button
                  type="button"
                  onClick={() => onFocus?.([row.zone.lat, row.zone.lng])}
                  className="min-w-0 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="truncate text-[11px] font-semibold text-white/85">{row.zone.name}</div>
                  <div className="truncate text-[9px] text-primary">{row.best.label} peak</div>
                </button>
                {row.cells.map((c) => {
                  const color = heatColor("earnings", c.value);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onFocus?.([row.zone.lat, row.zone.lng])}
                      className={`rounded-lg py-1.5 text-center text-[10px] font-bold text-white/90 active:scale-[0.97] transition-transform ${c.id === row.best.id ? "ring-1 ring-white/70" : ""}`}
                      style={{ background: `${color}2E` }}
                    >
                      ${c.value.toFixed(0)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 text-[9px] tracking-[0.14em] text-white/30">MODEL ESTIMATE · SHIFT-PLANNING PREVIEW ONLY</div>
    </div>
  );
}