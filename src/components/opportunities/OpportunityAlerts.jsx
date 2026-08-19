import { useEffect, useState } from "react";
import { Bell, BellRing, Car, MapPin, ChevronDown, ChevronUp, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

const VEHICLES = [
  { value: "personal_car", label: "Personal Car" },
  { value: "cargo_van", label: "Cargo Van" },
  { value: "box_truck", label: "Box Truck" },
  { value: "other", label: "Other" },
];

export default function OpportunityAlerts({ prefs, onPrefsChange }) {
  const [alerts, setAlerts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [regionInput, setRegionInput] = useState(prefs.region || "");
  const [vehicle, setVehicle] = useState(prefs.vehicle_type || "personal_car");
  const [enabled, setEnabled] = useState(Boolean(prefs.alert_enabled));

  useEffect(() => {
    setRegionInput(prefs.region || "");
    setVehicle(prefs.vehicle_type || "personal_car");
    setEnabled(Boolean(prefs.alert_enabled));
  }, [prefs.region, prefs.vehicle_type, prefs.alert_enabled]);

  async function loadAlerts() {
    try {
      const recs = await base44.entities.OpportunityAlert.filter({}, "-created_date", 20);
      setAlerts(recs);
    } catch (e) { /* best-effort */ }
  }
  useEffect(() => { loadAlerts(); }, []);

  const unread = alerts.filter((a) => !a.read).length;

  async function save() {
    setSaving(true);
    try {
      const payload = { alert_enabled: enabled, vehicle_type: vehicle, region: regionInput.trim() };
      if (prefs.id) {
        await base44.entities.DriverPreference.update(prefs.id, payload);
        onPrefsChange?.({ ...prefs, ...payload });
      } else {
        const created = await base44.entities.DriverPreference.create(payload);
        onPrefsChange?.({ ...prefs, ...created });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function markRead(a) {
    if (a.read) return;
    try {
      await base44.entities.OpportunityAlert.update(a.id, { read: true });
      setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, read: true } : x)));
    } catch (e) { /* best-effort */ }
  }

  return (
    <div className="rounded-2xl border border-white/10 lokin-panel overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-3"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${enabled ? "border-primary/40 bg-primary/10 glow-primary" : "border-white/15 bg-black/30"}`}>
            {enabled ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4 text-white/55" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-white/90 leading-tight">Match Alerts</span>
            <span className="block text-[11px] text-white/45 truncate">
              {enabled ? "On · we'll ping you the instant a match drops" : "Off · turn on to get pinged for new matches"}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {unread > 0 && (
            <span className="rounded-full bg-primary text-black text-[10px] font-bold px-2 py-0.5">{unread} new</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-white/50" /> : <ChevronDown className="h-4 w-4 text-white/50" />}
        </span>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/8 pt-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-white/80">Enable alerts</span>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-white/15"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </label>

          <div>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55 mb-1"><Car className="h-3 w-3" /> Vehicle type</span>
            <select
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            >
              {VEHICLES.map((v) => <option key={v.value} value={v.value} className="bg-black">{v.label}</option>)}
            </select>
          </div>

          <div>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55 mb-1"><MapPin className="h-3 w-3" /> Your region</span>
            <input
              value={regionInput}
              onChange={(e) => setRegionInput(e.target.value)}
              placeholder="e.g. Hampton Roads"
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-primary text-black text-sm font-bold py-2.5 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {saving ? "Saving…" : "Save alert preferences"}
          </button>

          {alerts.length > 0 && (
            <div className="pt-1 space-y-1.5">
              <span className="text-[11px] font-semibold text-white/45 uppercase tracking-wide">Recent alerts</span>
              {alerts.slice(0, 5).map((a) => (
                <button
                  key={a.id}
                  onClick={() => markRead(a)}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition ${a.read ? "border-white/8 bg-black/20" : "border-primary/30 bg-primary/5"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white/90 truncate">{a.opportunity_title}</span>
                    {!a.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    {a.read && <Check className="h-3 w-3 text-white/30 shrink-0" />}
                  </span>
                  <span className="block text-[11px] text-white/45 truncate">{a.match_reason}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}