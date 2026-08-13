import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, CheckCircle2, XCircle, Link2 } from "lucide-react";

const LABELS = {
  printful: "Printful",
  printify: "Printify",
  shopify: "Shopify",
  gmail: "Gmail",
};

export default function CommerceConnections() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("commerce-health", {});
      setData(res?.data || res);
    } catch (e) {
      setError(e?.message || "Connection check failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { check(); }, []);

  const services = data?.services || {};

  return (
    <section className="rounded-3xl border border-primary/20 lokin-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.24em] text-primary/70 font-display">COMMERCE CONNECTIONS</div>
          <div className="text-lg font-bold text-white flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> LOKIN Commerce Hub</div>
          <div className="text-xs text-white/45 mt-1">Printful · Printify · Shopify · Gmail</div>
        </div>
        <button onClick={check} disabled={loading}
          className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary disabled:opacity-50">
          <span className="flex items-center gap-2"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Test</span>
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        {Object.keys(LABELS).map((key) => {
          const s = services[key];
          const ok = Boolean(s?.connected);
          return (
            <div key={key} className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-white">{LABELS[key]}</div>
                {s ? (ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-red-400" />) : <div className="h-4 w-4 rounded-full border border-white/15" />}
              </div>
              <div className={`mt-1 text-[11px] ${ok ? "text-primary/80" : "text-white/40"}`}>
                {!s ? "Checking…" : ok ? "Connected" : "Needs attention"}
              </div>
              {ok && (s?.store?.name || s?.shop?.title || s?.shop?.name) && (
                <div className="mt-1 truncate text-[10px] text-white/35">{s?.store?.name || s?.shop?.title || s?.shop?.name}</div>
              )}
              {!ok && s?.error && <div className="mt-1 line-clamp-2 text-[10px] text-red-300/70">{String(s.error)}</div>}
            </div>
          );
        })}
      </div>

      {data && (
        <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${data.all_connected ? "border border-primary/25 bg-primary/10 text-primary" : "border border-white/10 bg-white/[0.03] text-white/55"}`}>
          {data.all_connected ? "All systems connected — LOKIN commerce is live." : `${data.connected_count || 0}/4 services connected.`}
        </div>
      )}
    </section>
  );
}
