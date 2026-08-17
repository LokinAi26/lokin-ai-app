import { useEffect, useState } from "react";
import { Save, Check, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { OPTIMIZATION_MODES, DAILY_GOAL_PRESETS } from "@/lib/deliveryLabels";
import { USER_TYPES } from "@/lib/userTypes";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import CommerceCredentials from "@/components/CommerceCredentials";
import InventoryMonitor from "@/components/InventoryMonitor";
import StockAlertSetup from "@/components/StockAlertSetup";
import OpenAICreditUsageGuardian from "@/components/OpenAICreditUsageGuardian";

export default function Settings() {
  const [prefs, setPrefs] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    setDeleting(true);
    try {
      const me = await base44.auth.me();
      const uid = me?.id;
      if (!uid) throw new Error("no user session");
      const [prefsList, blocked, fuel, avoid, earnings, offers, locators, gigs, purchases] = await Promise.all([
        base44.entities.DriverPreference.filter({ created_by_id: uid }),
        base44.entities.BlockedCustomer.filter({ created_by_id: uid }),
        base44.entities.FuelPurchase.filter({ created_by_id: uid }),
        base44.entities.AvoidPlace.filter({ created_by_id: uid }),
        base44.entities.Earning.filter({ created_by_id: uid }),
        base44.entities.Offer.filter({ created_by_id: uid }),
        base44.entities.LocatorItem.filter({ created_by_id: uid }),
        base44.entities.GigTask.filter({ assigned_to_id: uid }),
        base44.entities.Base44Purchase.filter({ appUserId: uid }),
      ]);
      await Promise.all([
        ...prefsList.map((p) => base44.entities.DriverPreference.delete(p.id)),
        ...blocked.map((b) => base44.entities.BlockedCustomer.delete(b.id)),
        ...fuel.map((f) => base44.entities.FuelPurchase.delete(f.id)),
        ...avoid.map((a) => base44.entities.AvoidPlace.delete(a.id)),
        ...earnings.map((e) => base44.entities.Earning.delete(e.id)),
        ...offers.map((o) => base44.entities.Offer.delete(o.id)),
        ...locators.map((l) => base44.entities.LocatorItem.delete(l.id)),
        ...gigs.map((g) => base44.entities.GigTask.delete(g.id)),
        ...purchases.map((p) => base44.entities.Base44Purchase.delete(p.id)),
      ]);
    } catch (e) {
      console.error("deleteAccount: purge failed", e);
    }
    try { await base44.auth.logout("/login"); } catch {}
  }

  useEffect(() => {
    base44.entities.DriverPreference.filter({}).then((p) => {
      const def = p[0];
      setPrefs(def);
      setForm(def || {
        user_type: "driver",
        vehicle_mpg: 26, gas_price: 3.45, min_per_hour: 22, mileage_cost: 0.67,
        daily_goal: 150, weekly_goal: 850, daily_hours_goal: 8, optimization_mode: "most_profit",
        accepted_categories: ["food_pickup", "grocery_shop_deliver", "grocery_pickup", "retail", "package"],
      });
    });
  }, []);

  function set(k, v) { setForm({ ...form, [k]: v }); setSaved(false); }

  async function save() {
    const data = { ...form };
    delete data.id; delete data.created_date; delete data.updated_date; delete data.created_by_id;
    let res;
    if (prefs?.id) res = await base44.entities.DriverPreference.update(prefs.id, data);
    else res = await base44.entities.DriverPreference.create(data);
    setPrefs(res); setSaved(true);
  }

  if (!form) return <div className="p-6 text-sm text-white/45">Loading…</div>;

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-2xl font-bold font-heading metal-text">Settings</h1>

      <Section title="I am a…">
        <div className="flex flex-wrap gap-2">
          {USER_TYPES.map((t) => (
            <button key={t.value} onClick={() => set("user_type", t.value)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${form.user_type === t.value ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Vehicle & Fuel">
        <Field label="Vehicle MPG"><Num value={form.vehicle_mpg} onChange={(v) => set("vehicle_mpg", v)} /></Field>
        <Field label="Fuel price $/gal"><Num value={form.gas_price} onChange={(v) => set("gas_price", v)} step={0.01} /></Field>
        <Field label="Mileage cost $/mi"><Num value={form.mileage_cost} onChange={(v) => set("mileage_cost", v)} step={0.01} /></Field>
      </Section>

      <Section title="Earnings Goals">
        <Field label="Min hourly rate $/hr"><Num value={form.min_per_hour} onChange={(v) => set("min_per_hour", v)} /></Field>
        <Field label="Daily hours goal"><Num value={form.daily_hours_goal} onChange={(v) => set("daily_hours_goal", v)} /></Field>
        <div>
          <div className="text-xs text-white/45 mb-1">Daily goal</div>
          <div className="flex flex-wrap gap-2">
            {DAILY_GOAL_PRESETS.map((g) => (
              <button key={g} onClick={() => set("daily_goal", g)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${form.daily_goal === g ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
                ${g}
              </button>
            ))}
            <input type="number" value={form.daily_goal} onChange={(e) => set("daily_goal", parseFloat(e.target.value) || 0)}
              className="w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-white" placeholder="Custom" />
          </div>
        </div>
        <Field label="Weekly goal $"><Num value={form.weekly_goal} onChange={(v) => set("weekly_goal", v)} /></Field>
      </Section>

      <Section title="Default Optimization Mode">
        <div className="flex flex-wrap gap-2">
          {OPTIMIZATION_MODES.map((m) => (
            <button key={m.value} onClick={() => set("optimization_mode", m.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${form.optimization_mode === m.value ? "border-accent bg-accent/15 text-accent" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </Section>

      <button onClick={save} className="w-full rounded-2xl bg-primary text-primary-foreground font-bold py-3.5 glow-primary flex items-center justify-center gap-2 select-none">
        {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save settings</>}
      </button>

      <OpenAICreditUsageGuardian />

      <CommerceCredentials />

      <InventoryMonitor />

      <StockAlertSetup prefs={prefs} onSaved={(p) => setPrefs(p)} />

      <div className="rounded-3xl border border-destructive/30 bg-destructive/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive mb-1">
          <Trash2 className="h-4 w-4" /> Delete Account
        </div>
        <p className="text-xs text-white/50 mb-3">
          Permanently remove your account and all LOKIN AI data. This cannot be undone.
        </p>
        <button onClick={() => setDeleteOpen(true)} className="w-full rounded-xl border border-destructive/40 bg-destructive/10 text-destructive font-bold py-2.5 text-sm flex items-center justify-center gap-2 select-none">
          <Trash2 className="h-4 w-4" /> Delete Account
        </button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-sm rounded-3xl border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete account permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out and erase your LOKIN AI profile, preferences, and history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAccount} disabled={deleting} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive">
              {deleting ? "Erasing…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs text-white/45 mb-1">{label}</div>
      {children}
    </div>
  );
}
function Num({ value, onChange, step = 1 }) {
  return (
    <input type="number" value={value} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white" />
  );
}