import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2, Unlink, RefreshCw, ExternalLink, Package, ShoppingBag, FileImage, Layers, Image as ImageIcon, Webhook } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LokinGlyph } from "@/components/Brand";

const CAPS = [
  { icon: Package, label: "Product Syncing" },
  { icon: ShoppingBag, label: "Orders" },
  { icon: FileImage, label: "File Library" },
  { icon: Layers, label: "Product Templates" },
  { icon: ImageIcon, label: "Mockups" },
  { icon: Webhook, label: "Webhooks" },
];

export default function PrintfulConnect() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("printful-catalog", { action: "connection" });
      setStatus(res.data);
    } catch (e) {
      setStatus(null);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function handleConnect() {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("printful-oauth-connect", {});
      const data = res.data;
      if (!data.configured) {
        setError(data.error || "Printful OAuth is not configured.");
        setBusy(false);
        return;
      }
      window.location.href = data.authorizeUrl;
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your Printful account? Tools will fall back to the shared personal API token.")) return;
    setBusy(true);
    try {
      await base44.functions.invoke("printful-catalog", { action: "disconnect" });
      await loadStatus();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.connected;
  const source = status?.source;

  return (
    <div className="p-4 space-y-5 pb-6">
      <div className="flex items-center gap-2">
        <LokinGlyph size={22} />
        <h1 className="text-xl font-bold font-heading metal-text">Printful Connect</h1>
      </div>

      <p className="text-sm text-white/55 leading-relaxed">
        Connect your Printful store with OAuth so LOKIN AI and ChatGPT can access product syncing, orders, the file library, product templates, mockups, and webhooks through your own account — no shared token required.
      </p>

      <div className={`rounded-2xl border p-4 ${connected ? "border-primary/40 bg-primary/[0.06]" : "border-white/10 lokin-panel"}`}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Checking connection…</div>
        ) : connected ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-primary">Connected via OAuth</div>
              <div className="text-xs text-white/50 mt-0.5">
                {status.store?.name ? `${status.store.name}${status.store.type ? ` · ${status.store.type}` : ""}` : "Store info unavailable"}
              </div>
              {status.connected_at && <div className="text-[11px] text-white/35 mt-1">Connected {new Date(status.connected_at).toLocaleDateString()}</div>}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-white/40 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-white/80">Not connected</div>
              <div className="text-xs text-white/50 mt-0.5">
                {source === "personal" ? "Using the shared personal API token as fallback." : "No Printful token available."}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

      <div className="flex gap-2">
        {connected ? (
          <button onClick={handleDisconnect} disabled={busy}
            className="flex-1 rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive py-3 flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />} Disconnect
          </button>
        ) : (
          <button onClick={handleConnect} disabled={busy || (status && !status.oauth_configured)}
            className="flex-1 rounded-2xl bg-primary text-primary-foreground py-3 flex items-center justify-center gap-2 text-sm font-bold glow-primary disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Connect Printful
          </button>
        )}
        <button onClick={loadStatus} disabled={busy} aria-label="Refresh"
          className="rounded-2xl border border-white/10 lokin-panel px-4 py-3 flex items-center justify-center text-white/70 disabled:opacity-60">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {status && !status.oauth_configured && !loading && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/[0.06] p-3 text-xs text-yellow-200/80">
          OAuth isn't fully configured yet. Add your <span className="font-semibold">Printful Public App</span> client id, secret, and redirect URL in the Base44 secrets panel, then republish.
        </div>
      )}

      <div className="space-y-2 pt-2">
        <div className="text-xs tracking-[0.2em] text-accent/70 font-display">CONNECTED CAPABILITIES</div>
        <div className="grid grid-cols-2 gap-2">
          {CAPS.map((c) => (
            <div key={c.label} className={`rounded-xl border p-2.5 flex items-center gap-2 ${connected ? "border-primary/30 bg-primary/[0.05]" : "border-white/8 bg-white/[0.02]"}`}>
              <c.icon className={`h-4 w-4 ${connected ? "text-primary" : "text-white/35"}`} />
              <span className={`text-xs ${connected ? "text-white/80" : "text-white/45"}`}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Link to="/connect" className="block text-center text-xs text-accent/70 pt-1">← Back to AI Connections</Link>
    </div>
  );
}