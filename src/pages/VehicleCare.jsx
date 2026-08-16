import { useEffect, useState } from "react";
import { Wrench, Search, Phone, Plus, Check, Trash2, MapPin, AlertTriangle, Clock, Navigation } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const CATEGORIES = [
  { value: "oil_change", label: "Oil Change", emoji: "🛢️", default_interval: 5000 },
  { value: "tire_rotation", label: "Tire Rotation", emoji: "🛞", default_interval: 5000 },
  { value: "brake", label: "Brakes", emoji: "🛑", default_interval: 25000 },
  { value: "battery", label: "Battery", emoji: "🔋", default_interval: 0 },
  { value: "inspection", label: "Inspection", emoji: "🔍", default_interval: 12000 },
  { value: "filter", label: "Air/Cabin Filter", emoji: "🌬️", default_interval: 15000 },
  { value: "fluid", label: "Fluids", emoji: "💧", default_interval: 30000 },
  { value: "other", label: "Other", emoji: "🔧", default_interval: 5000 },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export default function VehicleCare() {
  const [items, setItems] = useState([]);
  const [mileage, setMileage] = useState(() => localStorage.getItem("lokin_mileage") || "");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", category: "oil_change", last_done_mileage: "", interval_miles: 5000 });
  const [mechanicQuery, setMechanicQuery] = useState("");
  const [mechanicResults, setMechanicResults] = useState(null);
  const [searching, setSearching] = useState(false);

  async function load() {
    setItems(await base44.entities.MaintenanceLog.filter({}, "created_date"));
  }
  useEffect(() => { load(); }, []);

  function saveMileage(v) {
    setMileage(v);
    localStorage.setItem("lokin_mileage", v);
  }

  function computeStatus(item, mi) {
    if (!mi || !item.interval_miles || !item.last_done_mileage) return "upcoming";
    const nextDue = item.last_done_mileage + item.interval_miles;
    if (mi >= nextDue) return "overdue";
    if (mi >= nextDue - 500) return "due";
    return "upcoming";
  }

  async function add() {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      category: form.category,
      last_done_mileage: parseInt(form.last_done_mileage, 10) || 0,
      interval_miles: parseInt(form.interval_miles, 10) || CATEGORY_MAP[form.category]?.default_interval || 5000,
    };
    const created = await base44.entities.MaintenanceLog.create(payload);
    setItems([created, ...items]);
    setForm({ title: "", category: "oil_change", last_done_mileage: "", interval_miles: 5000 });
    setShowAdd(false);
  }

  async function markDone(item) {
    const mi = parseInt(mileage, 10) || item.last_done_mileage || 0;
    const updated = await base44.entities.MaintenanceLog.update(item.id, {
      last_done_mileage: mi,
      last_done_date: new Date().toISOString().slice(0, 10),
    });
    setItems(items.map((i) => (i.id === item.id ? updated : i)));
  }

  async function remove(id) {
    const prev = items;
    setItems(items.filter((i) => i.id !== id));
    try {
      await base44.entities.MaintenanceLog.delete(id);
    } catch {
      setItems(prev);
    }
  }

  async function findMechanic() {
    if (!mechanicQuery.trim()) return;
    setSearching(true);
    setMechanicResults(null);
    try {
      const res = await guardedInvoke(base44, "findMechanic", { location: mechanicQuery.trim() }, { userInitiated: true });
      setMechanicResults(res.data);
    } catch (e) {
      setMechanicResults({ error: e.message });
    } finally {
      setSearching(false);
    }
  }

  const currentMi = parseInt(mileage, 10) || 0;
  const sorted = [...items].sort((a, b) => {
    const order = { overdue: 0, due: 1, upcoming: 2, done: 3 };
    return (order[computeStatus(a, currentMi)] || 3) - (order[computeStatus(b, currentMi)] || 3);
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Vehicle Care</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">Stay on top of maintenance. Find a mechanic fast when you need one.</p>

      {/* Current mileage */}
      <div className="rounded-3xl border border-white/10 lokin-panel radial-fade p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-1">Current Mileage</div>
        <div className="flex items-center gap-2">
          <input type="number" value={mileage} onChange={(e) => saveMileage(e.target.value)} placeholder="Enter odometer reading"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-2xl font-bold font-display text-primary text-glow placeholder:text-white/20" />
          <span className="text-sm text-white/45 font-medium">mi</span>
        </div>
      </div>

      {/* Maintenance schedule */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/80">Maintenance Schedule</div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {showAdd && (
        <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-2.5">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Maintenance item (e.g. Oil Change)"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, interval_miles: CATEGORY_MAP[v]?.default_interval || form.interval_miles })}>
            <SelectTrigger className="rounded-xl border-white/10 bg-white/[0.03] text-white text-sm h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-white/10 text-white max-h-60">
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <input type="number" value={form.last_done_mileage} onChange={(e) => setForm({ ...form, last_done_mileage: e.target.value })} placeholder="Last done at (mi)"
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
            <input type="number" value={form.interval_miles} onChange={(e) => setForm({ ...form, interval_miles: e.target.value })} placeholder="Interval (mi)"
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
          </div>
          <button onClick={add} disabled={!form.title.trim()} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold disabled:opacity-60 glow-primary">
            Add to schedule
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="text-sm text-white/45 text-center py-6">No maintenance items yet. Tap Add to start tracking.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => {
            const status = computeStatus(item, currentMi);
            const cat = CATEGORY_MAP[item.category] || { emoji: "🔧", label: item.category };
            const nextDue = item.last_done_mileage + (item.interval_miles || 0);
            const milesLeft = nextDue - currentMi;
            return (
              <div key={item.id} className="rounded-2xl border border-white/10 lokin-panel p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-base">{cat.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white truncate">{item.title}</div>
                      <StatusBadge status={status} />
                    </div>
                    <div className="text-xs text-white/45 mt-0.5">{cat.label}</div>
                    {item.last_done_mileage > 0 && (
                      <div className="text-xs text-white/55 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Last: {item.last_done_mileage.toLocaleString()} mi</span>
                        {item.interval_miles > 0 && <span>Next: {nextDue.toLocaleString()} mi</span>}
                        {status === "upcoming" && milesLeft > 0 && <span className="text-primary">{milesLeft.toLocaleString()} mi left</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => markDone(item)} className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        <Check className="h-3 w-3" /> Mark done
                      </button>
                      <button onClick={() => remove(item.id)} aria-label="Remove" className="text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mechanic finder */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-accent" />
          <div className="text-sm font-semibold text-white/80">Find a Mechanic</div>
        </div>
        <p className="text-xs text-white/45 mb-2.5">Search for nearby auto repair shops and roadside assistance.</p>
        <div className="flex gap-2">
          <input value={mechanicQuery} onChange={(e) => setMechanicQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findMechanic()}
            placeholder="Zip code or city"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
          <button onClick={findMechanic} disabled={searching} className="rounded-xl bg-accent text-accent-foreground px-5 text-sm font-bold glow-cyan disabled:opacity-60">
            {searching ? "…" : "Search"}
          </button>
        </div>
        {searching && <div className="text-xs text-accent/70 mt-3 flex items-center gap-1"><Clock className="h-3 w-3 animate-pulse" /> Searching nearby mechanics…</div>}
        {mechanicResults?.error && <div className="text-sm text-destructive mt-3">{mechanicResults.error}</div>}
        {mechanicResults?.results && (
          <div className="space-y-2 mt-3">
            {mechanicResults.results.map((r, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{r.name}</div>
                  {r.rating > 0 && <span className="text-xs text-primary font-bold">★ {r.rating}</span>}
                </div>
                {r.address && <div className="text-xs text-white/55 mt-0.5 flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 text-white/40" />{r.address}</div>}
                {r.services && <div className="text-xs text-white/45 mt-1">{r.services}</div>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent"><Phone className="h-3 w-3" /> Call</a>}
                  {r.roadside_assistance && <span className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Roadside</span>}
                  {r.maps_url && <a href={r.maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/60"><Navigation className="h-3 w-3" /> Directions</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Roadside assistance */}
      <div className="rounded-3xl border border-accent/25 bg-accent/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent mb-2">
          <AlertTriangle className="h-4 w-4" /> Roadside Assistance
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href="tel:18004678437" className="flex items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-bold text-accent">
            <Phone className="h-4 w-4" /> Call Towing
          </a>
          <Link to="/lokin" className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 py-2.5 text-sm font-bold text-primary">
            <Wrench className="h-4 w-4" /> Ask LOKIN AI
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    overdue: { color: "text-destructive border-destructive/40 bg-destructive/10", label: "Overdue" },
    due: { color: "text-primary border-primary/40 bg-primary/10", label: "Due soon" },
    upcoming: { color: "text-white/45 border-white/15 bg-white/5", label: "Upcoming" },
    done: { color: "text-accent border-accent/40 bg-accent/10", label: "Done" },
  };
  const c = config[status] || config.upcoming;
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${c.color}`}>{c.label}</span>;
}