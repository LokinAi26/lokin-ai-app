import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import { Plus, Trash2, Sparkles, Loader2, Gauge, Target } from "lucide-react";

export default function CreditSection() {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ current_score: "", goal_score: "750", utilization_pct: "", on_time_streak: 0, target_date: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    const data = await base44.entities.CreditGoal.list("-updated_date", 10);
    const g = (data || [])[0];
    setGoal(g);
    if (g) setForm({ current_score: g.current_score || "", goal_score: g.goal_score || "750", utilization_pct: g.utilization_pct || "", on_time_streak: g.on_time_streak || 0, target_date: g.target_date || "" });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    const payload = {
      current_score: form.current_score ? Number(form.current_score) : null,
      goal_score: form.goal_score ? Number(form.goal_score) : null,
      utilization_pct: form.utilization_pct ? Number(form.utilization_pct) : null,
      on_time_streak: Number(form.on_time_streak) || 0,
      target_date: form.target_date || null,
    };
    if (goal) await base44.entities.CreditGoal.update(goal.id, payload);
    else await base44.entities.CreditGoal.create(payload);
    load();
  }

  async function runTips() {
    setBusy(true);
    setError(null);
    try {
      const res = await guardedInvoke(base44, "tax-advisor", { mode: "credit" }, { force: true, userInitiated: true });
      setResult(res.data?.credit);
    } catch (e) {
      setError(e?.message || "Engine failed");
    } finally {
      setBusy(false);
    }
  }

  const c = result;

  return (
    <div className="space-y-3">
      <form onSubmit={save} className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-2">
        <div className="text-[10px] tracking-widest text-white/40 font-display flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-primary" /> YOUR CREDIT PROFILE</div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" placeholder="Current score" value={form.current_score} onChange={(e) => setForm({ ...form, current_score: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <input type="number" placeholder="Goal score" value={form.goal_score} onChange={(e) => setForm({ ...form, goal_score: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <input type="number" placeholder="Utilization %" value={form.utilization_pct} onChange={(e) => setForm({ ...form, utilization_pct: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <input type="number" placeholder="On-time streak (mo)" value={form.on_time_streak} onChange={(e) => setForm({ ...form, on_time_streak: e.target.value })} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        </div>
        <input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
        <button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Save profile
        </button>
      </form>

      <button onClick={runTips} disabled={busy} className="w-full rounded-2xl border border-primary/40 bg-primary/15 py-3.5 text-sm font-bold text-primary glow-primary active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? "Building your plan…" : "Run Credit AI Engine"}
      </button>

      {error && <div className="text-xs text-destructive text-center">{error}</div>}

      {c && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary/25 lokin-panel radial-fade p-4">
            <div className="text-[10px] tracking-widest text-white/40 font-display mb-1">AI SUMMARY</div>
            <p className="text-sm text-white/85 leading-relaxed">{c.summary}</p>
          </div>
          {c.score_projection && <Line icon={Target} label="PROJECTION" value={c.score_projection} />}
          {c.utilization_advice && <Line icon={Gauge} label="UTILIZATION" value={c.utilization_advice} />}
          {c.tips?.length > 0 && (
            <div className="rounded-2xl border border-white/10 lokin-panel p-3">
              <div className="text-[10px] tracking-widest text-white/40 font-display mb-1">TIPS</div>
              {c.tips.map((t, i) => <div key={i} className="text-xs text-white/70 py-1 border-t border-white/8 first:border-t-0">• {t}</div>)}
            </div>
          )}
          {c.next_steps?.length > 0 && (
            <div className="rounded-2xl border border-primary/25 lokin-panel p-3">
              <div className="text-[10px] tracking-widest text-white/40 font-display mb-1">DO THIS WEEK</div>
              {c.next_steps.map((t, i) => <div key={i} className="text-xs text-primary py-1 border-t border-white/8 first:border-t-0">→ {t}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Line({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3 flex items-start gap-2">
      <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div>
        <div className="text-[10px] tracking-widest text-white/40 font-display">{label}</div>
        <div className="text-xs text-white/80 mt-0.5">{value}</div>
      </div>
    </div>
  );
}