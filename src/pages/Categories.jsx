import { useEffect, useState } from "react";
import { SlidersHorizontal, Ban, Plus, X, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CATEGORY_OPTIONS } from "@/lib/deliveryLabels";

export default function Categories() {
  const [prefs, setPrefs] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [newName, setNewName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  async function load() {
    const [p, b] = await Promise.all([
      base44.entities.DriverPreference.filter({}),
      base44.entities.BlockedCustomer.filter({}),
    ]);
    setPrefs(p[0] || null);
    setBlocked(b);
  }
  useEffect(() => { load(); }, []);

  async function toggleCat(value) {
    if (!prefs) return;
    setSavingCat(true);
    const set = new Set(prefs.accepted_categories || []);
    set.has(value) ? set.delete(value) : set.add(value);
    const updated = await base44.entities.DriverPreference.update(prefs.id, {
      accepted_categories: [...set],
    });
    setPrefs(updated);
    setSavingCat(false);
  }

  async function addBlocked() {
    if (!newName.trim()) return;
    const created = await base44.entities.BlockedCustomer.create({
      name: newName.trim(),
      reason: newReason.trim(),
    });
    setBlocked([created, ...blocked]);
    setNewName("");
    setNewReason("");
  }

  async function removeBlocked(id) {
    await base44.entities.BlockedCustomer.delete(id);
    setBlocked(blocked.filter((b) => b.id !== id));
  }

  const accepted = new Set(prefs?.accepted_categories || []);

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Work Filters</h1>
      </div>
      <p className="text-sm text-white/45 -mt-4">
        Tap the delivery types you accept. Offers you don&apos;t want are filtered out automatically.
      </p>

      <div className="space-y-2">
        {CATEGORY_OPTIONS.map((c) => {
          const on = accepted.has(c.value);
          return (
            <button
              key={c.value}
              onClick={() => toggleCat(c.value)}
              disabled={savingCat || !prefs}
              className={`w-full flex items-center justify-between rounded-2xl border p-3.5 text-left transition-colors ${
                on ? "border-primary bg-primary/[0.08] glow-border" : "border-white/10 lokin-panel"
              }`}
            >
              <span className="text-sm font-medium text-white">{c.label}</span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${on ? "bg-primary text-primary-foreground" : "bg-white/8 text-white/40"}`}>
                {on ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Ban className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold text-white/80">Blocked Customers</h2>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Customer name"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Reason (opt.)"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <button onClick={addBlocked} className="rounded-xl bg-primary text-primary-foreground px-3 disabled:opacity-50 glow-primary" disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {blocked.length === 0 ? (
          <div className="text-xs text-white/45 text-center py-4">No blocked customers.</div>
        ) : (
          <div className="space-y-2">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-2xl border border-white/10 lokin-panel p-3">
                <div>
                  <div className="text-sm font-medium text-white">{b.name}</div>
                  {b.reason && <div className="text-xs text-white/45">{b.reason}</div>}
                </div>
                <button onClick={() => removeBlocked(b.id)} className="text-destructive text-xs font-medium">Unblock</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}