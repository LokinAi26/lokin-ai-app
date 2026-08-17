import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, RefreshCw, Save, AlertTriangle, Gauge, KeyRound } from "lucide-react";
import { base44 } from "@/api/base44Client";

function money(v) {
  if (v === null || v === undefined) return "—";
  return `$${Number(v || 0).toFixed(4)}`;
}

export default function OpenAICreditUsageGuardian() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await base44.functions.invoke("openai-usage-guardian", { action: "status" });
      setData(res.data);
      setForm({
        monthly_budget_usd: res.data?.config?.monthly_budget_usd ?? 0,
        starting_credit_usd: res.data?.config?.starting_credit_usd ?? 0,
        input_rate_per_million: res.data?.config?.input_rate_per_million ?? 0,
        output_rate_per_million: res.data?.config?.output_rate_per_million ?? 0,
        warning_percent: res.data?.config?.warning_percent ?? 70,
        preservation_percent: res.data?.config?.preservation_percent ?? 90,
        block_when_over_budget: res.data?.config?.block_when_over_budget === true,
        enabled: res.data?.config?.enabled !== false,
      });
    } catch (e) { setError(e.message || "Guardian unavailable"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true); setError("");
    try {
      const normalized = {
        ...form,
        monthly_budget_usd: Math.max(0, Number(form.monthly_budget_usd || 0)),
        starting_credit_usd: Math.max(0, Number(form.starting_credit_usd || 0)),
        input_rate_per_million: Math.max(0, Number(form.input_rate_per_million || 0)),
        output_rate_per_million: Math.max(0, Number(form.output_rate_per_million || 0)),
        warning_percent: Math.min(100, Math.max(1, Number(form.warning_percent || 70))),
        preservation_percent: Math.min(100, Math.max(1, Number(form.preservation_percent || 90))),
      };
      if (normalized.preservation_percent <= normalized.warning_percent) {
        throw new Error("Preservation threshold must be higher than warning threshold.");
      }
      const res = await base44.functions.invoke("openai-usage-guardian", { action: "save-config", ...normalized });
      setData(res.data);
      setForm((f) => ({ ...f, ...res.data?.config }));
    } catch (e) { setError(e.message || "Could not save guardian settings"); }
    finally { setSaving(false); }
  }

  const mode = data?.summary?.mode || "normal";
  const modeLabel = useMemo(() => ({ normal: "NORMAL", warn: "WARNING", preserve: "PRESERVATION", block: "BLOCKED" }[mode] || "NORMAL"), [mode]);
  const pct = Math.min(100, Number(data?.summary?.budget_used_percent || 0));

  return (
    <div className="rounded-3xl border border-accent/25 bg-accent/[0.04] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-accent"><ShieldCheck className="h-4 w-4" /> OpenAI Credit & Usage Guardian</div>
          <p className="mt-1 text-[11px] text-white/45">Tracks LOKIN API usage without exposing your OpenAI secret key to the app UI.</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-lg border border-white/10 p-2 text-white/55"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-2 text-xs text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat icon={KeyRound} label="OpenAI" value={data?.configured ? "CONNECTED" : "NOT CONFIGURED"} />
        <Stat icon={Gauge} label="Guardian mode" value={modeLabel} />
        <Stat label="Calls this month" value={data?.summary?.calls ?? 0} />
        <Stat label="Tokens this month" value={Number(data?.summary?.total_tokens || 0).toLocaleString()} />
        <Stat label="Estimated spend" value={money(data?.summary?.estimated_spend_usd)} />
        <Stat label="Est. credit left" value={money(data?.summary?.estimated_credit_remaining_usd)} />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-[10px] text-white/45"><span>Monthly budget</span><span>{Number(data?.summary?.budget_used_percent || 0).toFixed(1)}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      {mode !== "normal" && (
        <div className="flex gap-2 rounded-xl border border-yellow-400/25 bg-yellow-400/[0.07] p-2.5 text-[11px] text-yellow-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{mode === "warn" ? "Usage has crossed your warning threshold." : mode === "preserve" ? "Preservation mode is active. LOKIN will use the configured low-cost model when available." : "Your configured monthly cap is blocking new external AI calls."}</span>
        </div>
      )}

      {form && <div className="space-y-3 border-t border-white/10 pt-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Guardian controls</div>
        <div className="grid grid-cols-2 gap-2">
          <Num label="Monthly API budget ($)" value={form.monthly_budget_usd} onChange={(v) => setForm({ ...form, monthly_budget_usd: v })} />
          <Num label="Starting prepaid credit ($)" value={form.starting_credit_usd} onChange={(v) => setForm({ ...form, starting_credit_usd: v })} />
          <Num label="Input $ / 1M tokens" value={form.input_rate_per_million} onChange={(v) => setForm({ ...form, input_rate_per_million: v })} />
          <Num label="Output $ / 1M tokens" value={form.output_rate_per_million} onChange={(v) => setForm({ ...form, output_rate_per_million: v })} />
          <Num label="Warn at %" value={form.warning_percent} onChange={(v) => setForm({ ...form, warning_percent: v })} />
          <Num label="Preserve at %" value={form.preservation_percent} onChange={(v) => setForm({ ...form, preservation_percent: v })} />
        </div>
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/65">
          <span>Block OpenAI calls at 100% budget</span><input type="checkbox" checked={form.block_when_over_budget} onChange={(e) => setForm({ ...form, block_when_over_budget: e.target.checked })} />
        </label>
        <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-accent-foreground"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Guardian"}</button>
        <p className="text-[10px] leading-relaxed text-white/35">Credit remaining is a local estimate based on the starting balance and token pricing you enter here. Your actual OpenAI billing balance remains authoritative.</p>
      </div>}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return <div className="rounded-xl border border-white/10 bg-black/10 p-2.5"><div className="flex items-center gap-1 text-[10px] text-white/35">{Icon && <Icon className="h-3 w-3" />}{label}</div><div className="mt-1 font-semibold text-white/80">{value}</div></div>;
}

function Num({ label, value, onChange }) {
  return (
    <label className="text-[10px] text-white/45">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value ?? ""}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange("");
          const next = Number(raw);
          if (Number.isFinite(next)) onChange(Math.max(0, next));
        }}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-xs text-white"
      />
    </label>
  );
}
