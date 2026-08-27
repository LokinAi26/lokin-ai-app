import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Database, KeyRound, Loader2, RefreshCcw, ShieldCheck, Unplug, Workflow } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_STYLE = {
  connected: "border-primary/35 bg-primary/10 text-primary",
  pending_authorization: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  pending: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  approval_required: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  manual_only: "border-white/15 bg-white/[0.04] text-white/60",
  expired: "border-red-400/35 bg-red-400/10 text-red-300",
  error: "border-red-400/35 bg-red-400/10 text-red-300",
  unsupported: "border-white/15 bg-white/[0.04] text-white/45",
  disconnected: "border-white/15 bg-white/[0.04] text-white/50",
};

function statusLabel(status) {
  return String(status || "disconnected").replaceAll("_", " ").toUpperCase();
}

function capabilityLabel(key) {
  return ({
    profile: "Profile",
    trips: "Trips",
    payments: "Payments",
    live_offers: "Live offers",
    partner_orders: "Partner orders",
  })[key] || key;
}

export default function DriverPlatforms() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingProvider, setWorkingProvider] = useState("");
  const [syncSummary, setSyncSummary] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("driver-platform-status", {});
      setData(response.data);
    } catch (nextError) {
      setError(nextError?.response?.data?.error || nextError?.message || "Could not load driver data sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function connectUber() {
    setWorkingProvider("uber-connect");
    setError("");
    try {
      const response = await base44.functions.invoke("uber-driver-oauth-connect", {});
      const url = response?.data?.authorize_url;
      if (!url) throw new Error(response?.data?.error || "Uber authorization URL was not returned");
      window.location.assign(url);
    } catch (nextError) {
      setError(nextError?.response?.data?.error || nextError?.message || "Could not start Uber authorization");
      setWorkingProvider("");
    }
  }

  async function syncUber() {
    setWorkingProvider("uber-sync");
    setError("");
    setSyncSummary(null);
    try {
      const response = await base44.functions.invoke("uber-driver-sync", { days: 30 });
      setSyncSummary(response.data);
      await load();
    } catch (nextError) {
      setError(nextError?.response?.data?.error || nextError?.message || "Could not sync Uber Driver data");
    } finally {
      setWorkingProvider("");
    }
  }

  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-display tracking-[0.2em] text-primary">
            <Database className="h-4 w-4" /> LOKIN DRIVER
          </div>
          <h1 className="mt-1 text-2xl font-black font-heading metal-text">Driver Data Sources</h1>
          <p className="mt-1 text-xs leading-relaxed text-white/45">Official integrations when approved; verified user capture everywhere else.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-primary disabled:opacity-50" aria-label="Refresh platform status">
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="rounded-3xl border border-primary/25 bg-primary/[0.045] p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="text-xs font-black text-white">Authorized-data boundary</div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              LOKIN only activates provider adapters after provider approval and server-side configuration. No screen scraping, GPS spoofing, acceptance bypass, or automatic third-party offer acceptance is used.
            </p>
          </div>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-white/10 lokin-panel p-8 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Checking provider readiness…
        </div>
      )}

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-4 text-sm text-red-200">{error}</div>}

      <div className="space-y-3">
        {(data?.providers || []).map((provider) => {
          const potential = Object.entries(provider.potential_capabilities || {}).filter(([, enabled]) => enabled);
          const active = Object.entries(provider.active_capabilities || {}).filter(([, enabled]) => enabled);
          return (
            <div key={provider.key} className="rounded-3xl border border-white/10 lokin-panel p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/35">
                  {provider.status === "connected" ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Unplug className="h-5 w-5 text-white/40" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-black text-white">{provider.label}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black tracking-wide ${STATUS_STYLE[provider.status] || STATUS_STYLE.disconnected}`}>
                      {statusLabel(provider.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{String(provider.access_mode || "").replaceAll("_", " ")}</div>
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-white/55">{provider.disclosure}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <State label="Provider approval" value={provider.approval_state} />
                <State label="Authorization" value={provider.authorization_state} />
                <State label="OAuth adapter" value={provider.oauth_adapter_configured ? "configured" : "not configured"} />
                <State label="Signed ingest" value={provider.signed_offer_ingest_configured ? "configured" : "not configured"} />
              </div>

              {potential.length > 0 && (
                <div className="mt-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">Provider surface after approval</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {potential.map(([key]) => (
                      <span key={key} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] text-white/55">{capabilityLabel(key)}</span>
                    ))}
                  </div>
                </div>
              )}

              {active.length > 0 && (
                <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/[0.035] p-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-primary/75">Production-active capabilities</div>
                  <div className="mt-1 text-[10px] text-white/65">{active.map(([key]) => capabilityLabel(key)).join(" · ")}</div>
                </div>
              )}

              {provider.key === "uber_eats" && (
                <div className="mt-3 space-y-2">
                  {provider.authorization_state === "authorized" && provider.credential_present && provider.approval_state !== "approved" && (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-3 text-[10px] leading-relaxed text-amber-100/75">
                      Driver OAuth is authorized for limited/developer access. Public production use still requires Uber approval for the Driver API scopes.
                    </div>
                  )}

                  {!provider.connect_available && (
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/35">OAuth setup required</div>
                      <div className="mt-1 text-[10px] leading-relaxed text-white/55">
                        Add {provider.missing_oauth_secrets?.length ? provider.missing_oauth_secrets.join(" · ") : "the Uber Driver OAuth secrets"} in Base44 Secrets.
                      </div>
                      <div className="mt-1 text-[9px] text-white/35">Redirect URI: {window.location.origin}/driver-platforms/uber/callback</div>
                    </div>
                  )}

                  {provider.connect_available && provider.authorization_state !== "authorized" && (
                    <button
                      type="button"
                      onClick={connectUber}
                      disabled={Boolean(workingProvider)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-xs font-black text-primary-foreground disabled:opacity-50"
                    >
                      {workingProvider === "uber-connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      CONNECT UBER DRIVER
                    </button>
                  )}

                  {provider.sync_available && (
                    <button
                      type="button"
                      onClick={syncUber}
                      disabled={Boolean(workingProvider)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/[0.07] py-2.5 text-xs font-black text-primary disabled:opacity-50"
                    >
                      {workingProvider === "uber-sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      SYNC LAST 30 DAYS
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {syncSummary?.counts && (
        <div className="rounded-3xl border border-primary/25 bg-primary/[0.045] p-4">
          <div className="text-xs font-black text-primary">Uber Outcome Learning updated</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <State label="Trips received" value={syncSummary.counts.trips_received} />
            <State label="Payments received" value={syncSummary.counts.payments_received} />
            <State label="New outcomes learned" value={syncSummary.counts.new_outcomes_learned} />
            <State label="Duplicates skipped" value={syncSummary.counts.duplicate_outcomes_skipped} />
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-white/40">Completed trips feed LOKIN's measured-outcome model. Repeat syncs are idempotent.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link to="/route" className="flex items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/[0.055] px-3 py-3 text-xs font-black text-primary">
          <Workflow className="h-4 w-4" /> VERIFIED CAPTURE
        </Link>
        <Link to="/earnings-intelligence" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 text-xs font-black text-white/75">
          <KeyRound className="h-4 w-4 text-primary" /> EARNINGS AI
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-[10px] leading-relaxed text-white/40">
        A provider showing “approval required” or “manual only” is intentionally not treated as connected. The signed ingest gateway remains deny-by-default until a provider is explicitly allowlisted on the server after approval.
      </div>
    </div>
  );
}

function State({ label, value }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-2.5">
      <div className="text-[8px] uppercase tracking-wider text-white/30">{label}</div>
      <div className="mt-0.5 truncate font-bold text-white/65">{String(value || "—").replaceAll("_", " ")}</div>
    </div>
  );
}
