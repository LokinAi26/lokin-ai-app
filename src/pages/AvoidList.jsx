import { useEffect, useState } from "react";
import { Ban, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { AVOID_TYPES, AVOID_REASONS } from "@/lib/deliveryLabels";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function AvoidList() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("store");
  const [reason, setReason] = useState("other");
  const [note, setNote] = useState("");

  async function load() {
    setItems(await base44.entities.AvoidPlace.filter({}, "-created_date"));
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), type, reason, note: note.trim() };
    const tempId = `tmp_${Date.now()}`;
    // optimistic insert
    setItems([{ ...payload, id: tempId }, ...items]);
    setName(""); setNote("");
    try {
      const created = await base44.entities.AvoidPlace.create(payload);
      setItems((cur) => cur.map((i) => (i.id === tempId ? created : i)));
    } catch (e) {
      // revert
      setItems((cur) => cur.filter((i) => i.id !== tempId));
    }
  }

  async function remove(id) {
    const prev = items;
    // optimistic remove
    setItems(items.filter((i) => i.id !== id));
    try {
      await base44.entities.AvoidPlace.delete(id);
    } catch (e) {
      // revert
      setItems(prev);
    }
  }

  const typeLabel = (v) => AVOID_TYPES.find((t) => t.value === v)?.label || v;
  const reasonLabel = (v) => AVOID_REASONS.find((t) => t.value === v)?.label || v;

  return (
    <div className="p-4 space-y-4">
      <div className="lokin-kicker lokin-kicker-lime">AVOID LIST</div>
      <div className="flex items-center gap-2">
        <Ban className="h-5 w-5 text-destructive" />
        <h1 className="text-xl font-bold font-heading metal-text">Avoid List</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">LOKIN AI skips these customers, stores, and locations when ranking opportunities.</p>

      <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-3.5 space-y-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (customer, store, location…)"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
        <div className="flex gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="flex-1 rounded-xl border-white/10 bg-white/[0.03] text-white text-sm h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-white/10 text-white max-h-60">
              {AVOID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="flex-1 rounded-xl border-white/10 bg-white/[0.03] text-white text-sm h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-white/10 text-white max-h-60">
              {AVOID_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
        <button onClick={add} disabled={!name.trim()} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-1.5 glow-primary">
          <Plus className="h-4 w-4" /> Add to avoid list
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-white/45 text-center py-6">No avoid entries yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-start justify-between rounded-2xl border border-white/10 lokin-panel lokin-card p-3.5">
              <div>
                <div className="text-sm font-medium text-white">{i.name}</div>
                <div className="text-xs text-white/45">{typeLabel(i.type)} · {reasonLabel(i.reason)}</div>
                {i.note && <div className="text-xs text-white/45 mt-0.5">{i.note}</div>}
              </div>
              <button onClick={() => remove(i.id)} className="text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}