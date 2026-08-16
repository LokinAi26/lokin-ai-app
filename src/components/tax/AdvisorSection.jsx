import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import { Sparkles, Loader2, TrendingUp } from "lucide-react";

export default function AdvisorSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await guardedInvoke(base44, "tax-advisor", { mode: "tax" }, { force: true, userInitiated: true });
      setResult(res.data);
    } catch (e) {
      setError(e?.message || "Advisor failed");
    } finally {
      setLoading(false);
    }
  }

  const a = result?.advisor;
  const s = result?.summary;

  return (
    <div className="space-y-3">
      <button onClick={run} disabled={loading} className="w-full rounded-2xl border border-primary/40 bg-primary/15 py-3.5 text-sm font-bold text-primary glow-primary active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Analyzing your books…" : "Run AI Tax Advisor"}
      </button>

      {error && <div className="text-xs text-destructive text-center">{error}</div>}

      {s && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="NET INCOME" value={`$${s.netIncome.toFixed(0)}`} />
          <Stat label="TOTAL DEDUCTIONS" value={`$${s.totalDeductions.toFixed(0)}`} />
        </div>
      )}

      {a && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary/25 lokin-panel radial-fade p-4">
            <div className="text-[10px] tracking-widest text-white/40 font-display mb-1">AI SUMMARY</div>
            <p className="text-sm text-white/85 leading-relaxed">{a.summary}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="EST. TAX" value={`$${Number(a.estimated_tax_owed).toFixed(0)}`} />
            <Stat label="/ QUARTER" value={`$${Number(a.estimated_quarterly_payment).toFixed(0)}`} />
            <Stat label="EFF. RATE" value={`${Number(a.effective_rate_pct).toFixed(1)}%`} />
          </div>

          {a.top_deductions?.length > 0 && (
            <Card title="TOP DEDUCTIONS">
              {a.top_deductions.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-2 py-1.5 border-t border-white/8 first:border-t-0">
                  <div className="min-w-0">
                    <div className="text-sm text-white">{d.name}</div>
                    <div className="text-[10px] text-white/45">{d.why}</div>
                  </div>
                  <div className="text-sm font-bold text-primary shrink-0">${Number(d.amount).toFixed(0)}</div>
                </div>
              ))}
            </Card>
          )}

          {a.missed_deductions?.length > 0 && (
            <Card title="YOU'RE LIKELY MISSING">
              {a.missed_deductions.map((d, i) => (
                <div key={i} className="text-xs text-white/70 py-1 border-t border-white/8 first:border-t-0 flex gap-1.5"><TrendingUp className="h-3 w-3 text-primary shrink-0 mt-0.5" />{d}</div>
              ))}
            </Card>
          )}

          {a.tips?.length > 0 && (
            <Card title="MONEY-SAVING TIPS">
              {a.tips.map((t, i) => (
                <div key={i} className="text-xs text-white/70 py-1 border-t border-white/8 first:border-t-0">• {t}</div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 lokin-panel p-2.5 text-center">
      <div className="text-[9px] tracking-widest text-white/40 font-display">{label}</div>
      <div className="font-display font-black text-lg text-primary text-glow">{value}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3">
      <div className="text-[10px] tracking-widest text-white/40 font-display mb-1">{title}</div>
      {children}
    </div>
  );
}