import { useEffect, useState } from "react";
import { Bell, BellRing, ScanLine, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function StockAlertSetup({ prefs, onSaved }) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanErr, setScanErr] = useState("");

  useEffect(() => {
    if (!prefs) return;
    setEnabled(!!prefs.stock_alert_enabled);
    setThreshold(prefs.stock_alert_threshold ?? 5);
    setEmail(prefs.stock_alert_email || "");
  }, [prefs]);

  async function save() {
    setSaving(true); setSaved(false);
    const data = { stock_alert_enabled: enabled, stock_alert_threshold: Number(threshold) || 5, stock_alert_email: email || undefined };
    try {
      const res = await base44.entities.DriverPreference.update(prefs.id, data);
      setSaved(true);
      onSaved?.(res);
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setScanning(true); setScanResult(null); setScanErr("");
    try {
      const res = await base44.functions.invoke("printify-stock-alert", {});
      setScanResult(res.data);
    } catch (e) {
      setScanErr(e.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4 text-white/50" />}
          <div>
            <div className="text-sm font-semibold text-white">Daily Stock Alert</div>
            <div className="text-[11px] text-white/45">Scans Printify at 9am &amp; emails you</div>
          </div>
        </div>
        <button
          onClick={() => setEnabled((e) => !e)}
          className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-white/15"}`}
          aria-label="Toggle daily stock alert"
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-white/45 mb-1">Low-stock threshold</div>
              <input type="number" min={0} value={threshold} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white" />
              <div className="text-[10px] text-white/35 mt-1">Variants enabled below this = low</div>
            </div>
            <div>
              <div className="text-xs text-white/45 mb-1">Alert email</div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30" />
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full rounded-xl bg-primary text-primary-foreground font-bold py-2.5 text-sm flex items-center justify-center gap-2 glow-primary disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <><Check className="h-4 w-4" /> Saved</> : "Save alert settings"}
          </button>

          <button onClick={runNow} disabled={scanning}
            className="w-full rounded-xl border border-primary/30 bg-primary/10 text-primary font-semibold py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] transition-transform">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            {scanning ? "Scanning…" : "Run scan now"}
          </button>

          {scanErr && <div className="text-xs text-destructive">{scanErr}</div>}
          {scanResult && (
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-primary font-semibold">
                <Check className="h-3.5 w-3.5" /> Scan complete
              </div>
              <div className="text-white/55">{scanResult.productsScanned ?? 0} products scanned · {scanResult.recipients ?? 0} alert email{scanResult.recipients === 1 ? "" : "s"} sent</div>
              {scanResult.reason && <div className="text-white/45">{scanResult.reason}</div>}
              {scanResult.alerts?.length > 0 && (
                <div className="text-white/55">Notified: {scanResult.alerts.map((a) => a.to).join(", ")}</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}