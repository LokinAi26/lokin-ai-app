import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { createOrQueue, getPendingByEntity, subscribeOfflineQueue } from "@/lib/offlineQueue";
import { Plus, Trash2, TrendingUp, CloudUpload } from "lucide-react";
import SelectSheet from "@/components/ui/SelectSheet";
import { SEEDS } from "@/lib/heatData";
import { VEHICLES, tagFromProfileType, vehicleLabel } from "@/lib/vehicleTags";

export default function IncomeSection() {
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", trips: 1, platform: "mixed", zone: "", vehicle: "" });

  // Default the vehicle tag to the driver's profile vehicle class.
  useEffect(() => {
    base44.entities.DriverPreference.filter({}).then((p) => {
      setForm((f) => (f.vehicle ? f : { ...f, vehicle: tagFromProfileType(p[0]?.vehicle_type) }));
    }).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.Earning.list("-date", 200);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); return subscribeOfflineQueue(() => setPending(getPendingByEntity("Earning"))); }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.amount) return;
    // Offline-safe: with no signal the delivery is stored locally and
    // syncs automatically once the connection returns.
    const res = await createOrQueue("Earning", { date: form.date, amount: Number(form.amount), trips: Number(form.trips) || 0, platform: form.platform, ...(form.zone ? { zone: form.zone } : {}), ...(form.vehicle ? { vehicle: form.vehicle } : {}) });
    setForm({ ...form, amount: "" });
    setPending(getPendingByEntity("Earning"));
    if (!res.queued) load();
  }
  async function del(id) { await base44.entities.Earning.delete(id); load(); }

  const ytd = items.filter((i) => (i.date || "").startsWith(String(new Date().getFullYear()))).reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/25 lokin-panel radial-fade p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-widest text-white/40 font-display">YTD INCOME</div>
          <div className="font-display font-black text-2xl text-primary text-glow">${ytd.toFixed(2)}</div>
        </div>
        <TrendingUp className="h-6 w-6 text-primary/60" />
      </div>

      <form onSubmit={add} className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <input type="number" step="0.01" placeholder="Amount $" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" placeholder="Trips" value={form.trips} onChange={(e) => setForm({ ...form, trips: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <input type="text" placeholder="Platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        </div>
        <SelectSheet
          value={form.zone}
          onChange={(v) => setForm({ ...form, zone: v })}
          options={[{ value: "", label: "Delivery zone — none" }, ...SEEDS.map((s) => ({ value: s.name, label: s.name }))]}
          label="Delivery zone"
          className="bg-black/50 border-white/10"
        />
        <SelectSheet
          value={form.vehicle}
          onChange={(v) => setForm({ ...form, vehicle: v })}
          options={[{ value: "", label: "Vehicle — none" }, ...VEHICLES.map((v) => ({ value: v.value, label: v.label }))]}
          label="Vehicle"
          className="bg-black/50 border-white/10"
        />
        <button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Log income
        </button>
      </form>

      <div className="space-y-1.5">
        {pending.map((q) => (
          <div key={q.id} className="flex items-center gap-3 rounded-xl border border-[#FFD200]/40 bg-[#FFD200]/[0.06] p-2.5">
            <CloudUpload className="h-4 w-4 text-[#FFD200] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">${Number(q.data.amount).toFixed(2)}</div>
              <div className="text-[10px] text-[#FFD200]/80">{q.data.date} · {q.data.trips || 0} trips · saved offline — syncs when back online</div>
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-white/40 text-center py-4">Loading…</div>}
        {!loading && items.length === 0 && pending.length === 0 && <div className="text-xs text-white/40 text-center py-4">No income logged yet.</div>}
        {items.slice(0, 20).map((i) => (
          <div key={i.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/30 p-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">${Number(i.amount).toFixed(2)}</div>
              <div className="text-[10px] text-white/40">{i.date} · {i.trips || 0} trips · {i.platform || "mixed"}{i.vehicle ? ` · ${vehicleLabel(i.vehicle)}` : ""}</div>
            </div>
            <button onClick={() => del(i.id)} className="text-white/30 active:scale-90"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}