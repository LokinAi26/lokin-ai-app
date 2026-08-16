import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  RefreshCw, CheckCircle2, XCircle, Copy, Check, KeyRound, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { guardedInvoke } from "@/lib/creditGuardian";

// LOKIN Commerce Credentials manager.
//
// Credentials are NEVER stored in the app or its database. They live as
// server-side Base44 Secrets, read only by backend functions at runtime. This
// panel is the secure management surface for those connections: it shows live
// status, and for anything not connected it lists the exact secret name(s) to
// paste into Base44 Settings -> Secrets so the connection can be finalized.

const SERVICES = [
  {
    key: "printful",
    label: "Printful",
    where: "Printful dashboard → Stores → API keys (Personal API token)",
    secrets: [{ name: "PRINTFUL_API_TOKEN", note: "Bearer token used by printful-catalog & the shipped-notifier workflow." }],
  },
  {
    key: "printify",
    label: "Printify",
    where: "Printify → Settings → Connections → Personal API token",
    secrets: [{ name: "PRINTIFY_API_TOKEN", note: "Personal API token; the shop id is resolved automatically from your shops list." }],
  },
  {
    key: "shopify",
    label: "Shopify",
    where: "Shopify Admin → Settings → Apps → Develop apps → create a custom app → Admin API access token",
    secrets: [
      { name: "SHOPIFY_STORE_DOMAIN", note: "e.g. my-store.myshopify.com (no https://)" },
      { name: "SHOPIFY_ACCESS_TOKEN", note: "Admin API access token (shp_…). Needs read_products / read_orders scopes." },
    ],
  },
  {
    key: "gmail",
    label: "Gmail",
    where: "Connected via the Base44 Gmail connector (OAuth) — managed in the Connectors panel, not via a secret.",
    secrets: [],
    oauth: true,
  },
];

function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(""), 1400);
    } catch { /* clipboard blocked — name still visible to retype */ }
  };
  return { copied, copy };
}

export default function CommerceCredentials() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { copied, copy } = useCopy();

  const check = async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await guardedInvoke(base44, "commerce-health", {}, { force, userInitiated: force });
      setData(res?.data || res);
    } catch (e) {
      setError(e?.message || "Connection check failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { check(); }, []);

  const services = data?.services || {};
  const connectedCount = data?.connected_count ?? Object.values(services).filter((s) => s?.connected).length;

  return (
    <div className="rounded-3xl border border-primary/20 lokin-panel p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.24em] text-primary/70 font-display">COMMERCE CREDENTIALS</div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Store Connections
          </div>
          <div className="text-xs text-white/45 mt-1">Printful · Printify · Shopify · Gmail</div>
        </div>
        <button onClick={() => check(true)} disabled={loading}
          className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary disabled:opacity-50 select-none">
          <span className="flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> {loading ? "Testing…" : "Re-test"}
          </span>
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed text-white/55">
          Credentials are stored securely as <span className="text-white/80 font-medium">Base44 Secrets</span> on the
          server — never in the app. Paste each value into <span className="text-white/80 font-medium">Base44 Settings → Secrets</span>{" "}
          using the exact names below, then tap Re-test to finalize.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      <div className="space-y-2.5">
        {SERVICES.map((svc) => {
          const s = services[svc.key];
          const ok = Boolean(s?.connected);
          const demo = s?.mode === "demo";
          return (
            <div key={svc.key} className="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-white">{svc.label}</div>
                <StatusBadge ok={ok} demo={demo} loading={!s && !error} />
              </div>

              {ok && (s?.store?.name || s?.shop?.title || s?.shop?.name) && (
                <div className="text-[11px] text-primary/80 truncate">
                  {s?.store?.name || s?.shop?.title || s?.shop?.name}
                </div>
              )}

              {!ok && s?.error && (
                <div className="flex items-start gap-1.5 text-[10px] text-red-300/80">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{String(s.error)}{s?.status ? ` (HTTP ${s.status})` : ""}</span>
                </div>
              )}

              <div className="text-[10px] text-white/40">{svc.where}</div>

              {svc.secrets.length > 0 && (
                <div className="space-y-1.5">
                  {svc.secrets.map((sec) => (
                    <div key={sec.name} className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] font-mono text-primary/90">
                        {sec.name}
                      </code>
                      <button
                        onClick={() => copy(sec.name)}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-white/60 hover:text-white select-none"
                        aria-label={`Copy ${sec.name}`}
                      >
                        {copied === sec.name ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!ok && svc.secrets.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.04] px-2.5 py-1.5 text-[10px] text-white/55">
                  <span className="text-primary/80">→</span>
                  Paste the value into <span className="text-primary font-mono">Base44 Settings → Secrets</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${data?.all_connected ? "border border-primary/25 bg-primary/10 text-primary" : "border border-white/10 bg-white/[0.03] text-white/55"}`}>
        {data?.all_connected
          ? "All commerce connections live — LOKIN store is operational."
          : `${connectedCount}/${SERVICES.length} services connected.`}
      </div>
    </div>
  );
}

function StatusBadge({ ok, demo, loading }) {
  if (loading) return <span className="text-[11px] text-white/40">Checking…</span>;
  if (ok) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
        <CheckCircle2 className="h-4 w-4" /> Connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-white/55">
      <XCircle className="h-4 w-4 text-red-400" /> {demo ? "Demo mode" : "Needs setup"}
    </span>
  );
}