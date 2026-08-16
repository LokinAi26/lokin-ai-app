import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Gauge, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";

function fmt(n) { return Number.isFinite(Number(n)) ? Number(n).toLocaleString() : "0"; }

export default function AIHealthGuardian() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const me = await base44.auth.me();
      if (me?.role !== "admin") { setError("Admin only"); return; }
      const data = await base44.entities.LokinAIGatewayTelemetry.filter({}, "-occurred_at", 50);
      setRows(data || []);
    } catch (e) {
      setError(e?.message || "AI telemetry unavailable");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const m = useMemo(() => {
    const total = rows.length;
    const success = rows.filter(r => r.status === "success").length;
    const external = rows.filter(r => r.provider === "openai").length;
    const fallback = rows.filter(r => String(r.provider || "").includes("fallback")).length;
    const latencyRows = rows.filter(r => Number(r.latency_ms) > 0);
    const avgLatency = latencyRows.length ? Math.round(latencyRows.reduce((s,r)=>s+Number(r.latency_ms||0),0)/latencyRows.length) : 0;
    const tokens = rows.reduce((s,r)=>s+Number(r.total_tokens||0),0);
    const successRate = total ? Math.round(success/total*100) : 0;
    return { total, success, external, fallback, avgLatency, tokens, successRate };
  }, [rows]);

  if (error === "Admin only") return null;

  return <section className="rounded-3xl border border-accent/20 lokin-panel overflow-hidden">
    <div className="p-4 border-b border-white/8 bg-gradient-to-r from-accent/[0.08] to-transparent flex items-start justify-between gap-3">
      <div><div className="text-[11px] tracking-[.22em] text-accent/75 font-display">AI HEALTH + COST GUARDIAN</div><div className="mt-1 text-lg font-black text-white flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent"/> Gateway control plane</div><div className="text-xs text-white/40">Operational metadata only — prompts and conversations are not stored here.</div></div>
      <button onClick={load} disabled={loading} className="rounded-xl border border-accent/25 bg-accent/10 p-2 text-accent"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>
    </div>
    <div className="p-4 space-y-3">
      {error && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200 flex gap-2"><AlertTriangle className="h-4 w-4"/>{error}</div>}
      <div className="grid grid-cols-4 gap-2">
        <Metric icon={CheckCircle2} label="Success" value={`${m.successRate}%`} />
        <Metric icon={Gauge} label="Latency" value={m.avgLatency ? `${m.avgLatency}ms` : "—"} />
        <Metric icon={Zap} label="Tokens" value={fmt(m.tokens)} />
        <Metric icon={Activity} label="Fallback" value={m.fallback} />
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="px-3 py-2 text-[10px] tracking-[.16em] text-white/40 border-b border-white/8">RECENT GATEWAY EVENTS</div>
        {rows.slice(0,8).map((r,i)=><div key={r.id||i} className="px-3 py-2.5 border-t border-white/6 first:border-t-0 flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${r.status==="success"?"bg-primary":"bg-amber-400"}`}/>
          <div className="min-w-0 flex-1"><div className="text-xs font-bold text-white">{String(r.provider||"unknown").toUpperCase()} · {r.model||"local"}</div><div className="text-[10px] text-white/35">{r.mode||"assistant"} · {r.latency_ms||0}ms · {fmt(r.total_tokens)} tokens</div></div>
          <div className="text-[9px] text-white/30">{r.occurred_at ? new Date(r.occurred_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}) : ""}</div>
        </div>)}
        {!rows.length && <div className="p-4 text-center text-xs text-white/35">No AI telemetry yet. Use LOKIN AI once, then refresh.</div>}
      </div>
    </div>
  </section>;
}

function Metric({icon:Icon,label,value}) { return <div className="rounded-xl border border-white/10 bg-black/35 p-2 text-center"><Icon className="h-4 w-4 mx-auto text-accent"/><div className="mt-1 text-sm font-black text-white">{value}</div><div className="text-[8px] tracking-wider uppercase text-white/35">{label}</div></div>; }
