import { useState } from "react";
import { X, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { USER_TYPES } from "@/lib/userTypes";

// Bottom sheet to pick how LOKIN AI tailors itself: Driver, Trucker, or Traveler.
export default function UserTypeSelector({ open, onClose, prefs, onSaved }) {
  const [selected, setSelected] = useState(prefs?.user_type || "driver");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function save(value) {
    setSelected(value);
    setSaving(true);
    try {
      if (prefs?.id) {
        await base44.entities.DriverPreference.update(prefs.id, { user_type: value });
      } else {
        await base44.entities.DriverPreference.create({ user_type: value });
      }
      onSaved?.(value);
      setTimeout(onClose, 350);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl border-t border-primary/30 bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="font-semibold text-white">How do you roll?</div>
            <div className="text-xs text-white/45">Tailor LOKIN AI to your road.</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-white/10">
            <X className="h-4 w-4 text-white/60" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {USER_TYPES.map((t) => {
            const active = selected === t.value;
            return (
              <button
                key={t.value}
                onClick={() => save(t.value)}
                disabled={saving}
                className={`w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors active:scale-[0.99] ${
                  active ? "border-primary bg-primary/10 glow-primary" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${active ? "text-primary" : "text-white"}`}>{t.label}</div>
                  <div className="text-xs text-white/45">{t.tagline}</div>
                </div>
                {active && <Check className="h-5 w-5 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}