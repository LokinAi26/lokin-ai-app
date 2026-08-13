import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Route } from "lucide-react";

const RATE = { business: 0.7, medical: 0.21, charitable: 0.14, moving: 0.21, personal: 0 };
const TYPES = [["business", "Business $0.70/mi"], ["medical", "Medical $0.21/mi"], ["charitable", "Charitable $0.14/mi"], ["moving", "Moving $0.21/mi"], ["personal", "Personal $0"]];

export default function MileageSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), miles: "", type: "business", purpose: "" });

  async function load() {
    setLoading(true);
    const data = await base44.entities.MileageLog.list("-date", 200);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.miles) return;
    const miles = Number(form.miles);
    await base44.entities.MileageLog.create({
      date: form.date,
      miles,
      type: form.type,
      purpose: form.purpose,
      deduction: Math.round(miles * (RATE[form.type] || 0) * 100) / 100,
    });
    setForm({ ...form, miles: "", purpose: "" });
    load();
  }
  async function del(id) { await base44.entities.MileageLog.delete(id); load(); }

  const bizMiles = items.filter((i) => i.type === "business").reduce((s, i) => s + (Number(i.miles) || 0), 0);
  const totalDeduction = items.reduce((s, i) => s + (Number(i.deduction) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-primary/25 lokin-panel p-3">
          <div className="text-[10px] tracking-widest text-white/40 font-display">BUSINESS MILES</div>
          <div className="font-display font-black text-xl text-primary text-glow">{bizMiles.toFixed(0)}</div>
        </div>
        <div className="rounded-2xl border border-primary/25 lokin-panel p-3">
          <div className="text-[10px] tracking-widest text-white/40 font-display">DEDUCTION</div>
          <div className="font-display font-black text-xl text-primary text-glow">${totalDeduction.toFixed(2)}</div>
        </div>
      </div>

      <form onSubmit={add} className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <input type="number" step="0.1" placeholder="Miles" value={form.miles} onChange={(e) => setForm({ ...form, miles: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        </div>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="text" placeholder="Purpose (e.g. pickup → dropoff)" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        <button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Log miles
        </button>
      </form>

      <div className="space-y-1.5">
        {loading && <div className="text-xs text-white/40 text-center py-4">Loading…</div>}
        {!loading && items.length === 0 && <div className="text-xs text-white/40 text-center py-4">No miles logged yet.</div>}
        {items.slice(0, 20).map((i) => (
          <div key={i.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/30 p-2.5">
            <Route className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">{Number(i.miles).toFixed(1)} mi · ${Number(i.deduction).toFixed(2)}</div>
              <div className="text-[10px] text-white/40 truncate">{i.date} · {i.type} · {i.purpose || "—"}</div>
            </div>
            <button onClick={() => del(i.id)} className="text-white/30 active:scale-90"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}