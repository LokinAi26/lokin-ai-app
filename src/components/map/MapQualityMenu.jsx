import { useEffect, useRef, useState } from "react";
import { Check, Gauge } from "lucide-react";

const LEVELS = [
  { value: "ultra", label: "3D ULTRA", hint: "Shadows + landmarks" },
  { value: "balanced", label: "3D BALANCED", hint: "Buildings, no shadows" },
  { value: "performance", label: "PERFORMANCE", hint: "Flat map · battery saver" },
];

// Floating 3D map quality switcher for the GPS map controls: tap the gauge
// chip to open a popup with the three quality presets.
export default function MapQualityMenu({ quality, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const active = LEVELS.find((l) => l.value === quality) || LEVELS[1];

  useEffect(() => {
    if (!open) return undefined;
    function onDocDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Switch 3D map quality"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center rounded-full border border-primary/30 bg-black/85 px-3 text-[9px] font-extrabold tracking-[0.08em] text-primary shadow-lg backdrop-blur active:scale-95"
      >
        <Gauge className="mr-1.5 h-3.5 w-3.5" />{active.label}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-56 rounded-2xl border border-primary/30 bg-black/92 p-1.5 shadow-2xl backdrop-blur">
          <div className="px-3 pb-1 pt-2 text-[9px] font-extrabold tracking-[0.18em] text-white/40">3D MAP QUALITY</div>
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => { onChange(l.value); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left ${quality === l.value ? "bg-primary/15 text-primary" : "text-white/70 active:bg-white/5"}`}
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold tracking-[0.06em]">{l.label}</span>
                <span className="block text-[9px] text-white/40">{l.hint}</span>
              </span>
              {quality === l.value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}