import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Receipt } from "lucide-react";

const CATEGORIES = ["phone", "supplies", "equipment", "fuel", "maintenance", "insurance", "parking", "tolls", "meals", "software", "other"];

export default function DeductionsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: "phone", amount: "", vendor: "", deductible: true });

  async function load() {
    setLoading(true);
    const data = await base44.entities.Expense.list("-date", 200);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.amount) return;
    await base44.entities.Expense.create({
      date: form.date, category: form.category, amount: Number(form.amount), vendor: form.vendor, deductible: form.deductible,
    });
    setForm({ ...form, amount: "", vendor: "" });
    load();
  }
  async function del(id) { await base44.entities.Expense.delete(id); load(); }

  const total = items.filter((i) => i.deductible !== false).reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/25 lokin-panel radial-fade p-4">
        <div className="text-[10px] tracking-widest text-white/40 font-display">DEDUCTIBLE EXPENSES</div>
        <div className="font-display font-black text-2xl text-primary text-glow">${total.toFixed(2)}</div>
      </div>

      <form onSubmit={add} className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <input type="number" step="0.01" placeholder="Amount $" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="min-h-11 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" placeholder="Vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        </div>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input type="checkbox" checked={form.deductible} onChange={(e) => setForm({ ...form, deductible: e.target.checked })} className="accent-[#AAFF00]" />
          Deductible business expense
        </label>
        <button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Add expense
        </button>
      </form>

      <div className="space-y-1.5">
        {loading && <div className="text-xs text-white/40 text-center py-4">Loading…</div>}
        {!loading && items.length === 0 && <div className="text-xs text-white/40 text-center py-4">No expenses logged yet.</div>}
        {items.slice(0, 20).map((i) => (
          <div key={i.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/30 p-2.5">
            <Receipt className={`h-4 w-4 shrink-0 ${i.deductible !== false ? "text-primary" : "text-white/30"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">${Number(i.amount).toFixed(2)} · {i.category}</div>
              <div className="text-[10px] text-white/40 truncate">{i.date} · {i.vendor || "—"} {i.deductible === false && "· non-deductible"}</div>
            </div>
            <button onClick={() => del(i.id)} className="text-white/30 active:scale-90"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}