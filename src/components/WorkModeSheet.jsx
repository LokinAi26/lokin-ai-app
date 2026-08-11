import { useEffect, useState } from "react";
import { X, Check, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LokinGlyph } from "@/components/Brand";
import { WORK_MODES, WORK_FILTERS } from "@/lib/deliveryLabels";

export default function WorkModeSheet({ open, onClose, prefs, onStarted }) {
  const [modes, setModes] = useState(prefs?.active_modes || ["delivery"]);
  const [filters, setFilters] = useState(prefs?.work_filters || []);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (open) {
      setModes(prefs?.active_modes || ["delivery"]);
      setFilters(prefs?.work_filters || []);
      setLocked(false);
    }
  }, [open, prefs]);

  if (!open) return null;

  function toggle(list, setList, val) {
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  async function start() {
    setSaving(true);
    try {
      const data = {
        work_status: "working",
        active_modes: modes.length ? modes : ["delivery"],
        work_filters: filters,
      };
      if (prefs?.id) await base44.entities.DriverPreference.update(prefs.id, data);
      else await base44.entities.DriverPreference.create(data);
      setLocked(true);
      onStarted?.();
      setTimeout(() => { onClose(); }, 2200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl border-t border-primary/30 bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto no-scrollbar">
        {locked ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-primary/10 glow-primary mb-5">
              <LokinGlyph size={48} />
            </div>
            <div className="font-display text-2xl font-extrabold tracking-[0.15em] text-primary text-glow">YOU&apos;RE LOCKED IN.</div>
            <div className="text-sm text-white/55 mt-2">Lock in your time. Make more.</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-white">Start Work</div>
                <div className="text-xs text-white/45">Choose your modes — pick more than one.</div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg border border-white/10"><X className="h-4 w-4 text-white/60" /></button>
            </div>

            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80 mb-2">Work Modes</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {WORK_MODES.map((m) => {
                const on = modes.includes(m.value);
                return (
                  <button key={m.value} onClick={() => toggle(modes, setModes, m.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${on ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent/80 mb-2">Work Filters</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {WORK_FILTERS.map((f) => {
                const on = filters.includes(f.value);
                return (
                  <button key={f.value} onClick={() => toggle(filters, setFilters, f.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${on ? "border-accent bg-accent/15 text-accent" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
                    {f.label}
                  </button>
                );
              })}
            </div>

            <button onClick={start} disabled={saving}
              className="w-full rounded-2xl glow-border lokin-panel radial-fade py-4 font-bold disabled:opacity-60 flex items-center justify-center gap-2">
              <LokinGlyph size={22} />
              <span className="font-display text-lg tracking-[0.15em] text-primary text-glow">{saving ? "LOCKING IN…" : "START WORK"}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}