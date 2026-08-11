import { useEffect, useState } from "react";
import { Save, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { OPTIMIZATION_MODES, DAILY_GOAL_PRESETS } from "@/lib/deliveryLabels";

export default function Settings() {
  const [prefs, setPrefs] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.entities.DriverPreference.filter({}).then((p) => {
      const def = p[0];
      setPrefs(def);
      setForm(def || {
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

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-2xl font-bold font-heading">Settings</h1>

      <Section title="Vehicle & Fuel">
        <Field label="Vehicle MPG"><Num value={form.vehicle_mpg} onChange={(v) => set("vehicle_mpg", v)} /></Field>
        <Field label="Fuel price $/gal"><Num value={form.gas_price} onChange={(v) => set("gas_price", v)} step={0.01} /></Field>
        <Field label="Mileage cost $/mi"><Num value={form.mileage_cost} onChange={(v) => set("mileage_cost", v)} step={0.01} /></Field>
      </Section>

      <Section title="Earnings Goals">
        <Field label="Min hourly rate $/hr"><Num value={form.min_per_hour} onChange={(v) => set("min_per_hour", v)} /></Field>
        <Field label="Daily hours goal"><Num value={form.daily_hours_goal} onChange={(v) => set("daily_hours_goal", v)} /></Field>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Daily goal</div>
          <div className="flex flex-wrap gap-2">
            {DAILY_GOAL_PRESETS.map((g) => (
              <button key={g} onClick={() => set("daily_goal", g)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border ${form.daily_goal === g ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                ${g}
              </button>
            ))}
            <input type="number" value={form.daily_goal} onChange={(e) => set("daily_goal", parseFloat(e.target.value) || 0)}
              className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm" placeholder="Custom" />
          </div>
        </div>
        <Field label="Weekly goal $"><Num value={form.weekly_goal} onChange={(v) => set("weekly_goal", v)} /></Field>
      </Section>

      <Section title="Default Optimization Mode">
        <div className="flex flex-wrap gap-2">
          {OPTIMIZATION_MODES.map((m) => (
            <button key={m.value} onClick={() => set("optimization_mode", m.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border ${form.optimization_mode === m.value ? "border-accent bg-accent/15 text-accent" : "border-border bg-muted text-muted-foreground"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </Section>

      <button onClick={save} className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-3 glow-primary flex items-center justify-center gap-2">
        {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save settings</>}
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
function Num({ value, onChange, step = 1 }) {
  return (
    <input type="number" value={value} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
  );
}