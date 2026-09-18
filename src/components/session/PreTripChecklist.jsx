import { CheckCircle2, Circle } from "lucide-react";

// Quick pre-trip vehicle checklist shown at session start. Tapped items are
// logged with the session (TripCheck record) so the end-of-shift recap can
// show what was verified before driving.
export const PRE_TRIP_ITEMS = [
  { key: "tire_pressure", label: "Tire pressure" },
  { key: "fuel_level", label: "Fuel level" },
  { key: "oil_fluids", label: "Oil & fluids" },
  { key: "lights_signals", label: "Lights & signals" },
  { key: "brakes_horn", label: "Brakes & horn" },
  { key: "mirrors_seatbelt", label: "Mirrors & seatbelt" },
  { key: "phone_charged", label: "Phone charged & mounted" },
  { key: "documents", label: "License, insurance, registration" },
];

export default function PreTripChecklist({ checked = [], onToggle, onCheckAll }) {
  const done = PRE_TRIP_ITEMS.filter((i) => checked.includes(i.key)).length;
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
          Pre-Trip Checklist <span className="text-white/40">({done}/{PRE_TRIP_ITEMS.length})</span>
        </div>
        <button
          onClick={onCheckAll}
          className="min-h-11 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent"
        >
          Check all
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PRE_TRIP_ITEMS.map((i) => {
          const on = checked.includes(i.key);
          return (
            <button
              key={i.key}
              onClick={() => onToggle(i.key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                on ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/55"
              }`}
            >
              {on ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
              <span className="text-[11px] font-medium leading-tight">{i.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}