import { useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Activity,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const STYLES = {
  HEALTHY: { color: "text-primary", border: "border-primary/30", bg: "bg-primary/10", icon: ShieldCheck },
  WARNING: { color: "text-amber-300", border: "border-amber-500/30", bg: "bg-amber-500/10", icon: AlertTriangle },
  ACTION_REQUIRED: { color: "text-red-300", border: "border-red-500/30", bg: "bg-red-500/10", icon: AlertOctagon },
};

function pretty(s = "") {
  return String(s).replace(/_/g, " ");
}

export default function CommerceReliabilityDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("commerce-reliability", {});
      setData(res?.data || res);
    } catch (e) {
      setError(e?.message || "Reliability check unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const overall = data?.overall || "HEALTHY";
  const o = STYLES[overall] || STYLES.HEALTHY;
  const OIcon = o.icon;

  return (
    <section className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-[11px] tracking-[0.24em] text-white/70 font-display">
          <Activity className="h-3.5 w-3.5" /> COMMERCE RELIABILITY LAYER
          {open ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="w-full sm:w-auto rounded-full border border-primary/30 bg-primary/10 px-4 py-2.5 text-[11px] font-bold text-primary disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> {loading ? "Checking…" : "Run Safe Commerce Check"}
        </button>
      </div>

      <div className={`flex flex-wrap items-center gap-2 rounded-2xl border ${o.border} ${o.bg} px-3 py-2`}>
        <OIcon className={`h-4 w-4 ${o.color}`} />
        <span className={`text-xs font-black ${o.color}`}>{pretty(overall)}</span>
        <span className="text-[10px] text-white/40 sm:ml-auto w-full sm:w-auto text-left sm:text-right">{data ? new Date(data.checked_at).toLocaleString() : ""}</span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-2 text-[11px] text-red-300">{error}</div>
      )}

      {!data && loading && (
        <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      )}

      {open && data?.checks && (
        <div className="space-y-1.5">
          {data.checks.map((c) => {
            const s = STYLES[c.status] || STYLES.HEALTHY;
            const I = s.icon;
            return (
              <div key={c.key} className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/30 p-2.5">
                <I className={`h-4 w-4 ${s.color} mt-0.5 shrink-0`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white">{c.label}</div>
                  <div className="text-[10px] text-white/50">{c.detail}</div>
                  {c.key === "sku_variant_mapping" && (
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[9px]">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary">MAPPED {c.mapped ?? 0}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-white/55">VARIANTS {c.variants ?? 0}</span>
                    </div>
                  )}
                  {c.remediation && c.status !== "HEALTHY" && (
                    <div className="mt-1 text-[9px] leading-relaxed text-amber-200/70 border-l border-amber-500/20 pl-2">
                      <span className="font-bold">Fix:</span> {c.remediation}
                    </div>
                  )}
                </div>
                <span className={`text-[9px] font-bold ${s.color} shrink-0`}>{pretty(c.status)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[8px] text-white/25">Read-only · no credentials exposed · auto-refreshes every 60s</div>
    </section>
  );
}