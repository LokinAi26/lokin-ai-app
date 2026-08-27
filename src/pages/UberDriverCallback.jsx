import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function UberDriverCallback() {
  const [state, setState] = useState({ loading: true, error: "", result: null });

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const payload = {
      code: params.get("code") || "",
      state: params.get("state") || "",
      error: params.get("error") || "",
      error_description: params.get("error_description") || "",
    };
    base44.functions.invoke("uber-driver-oauth-callback", payload)
      .then((response) => {
        if (alive) setState({ loading: false, error: "", result: response.data });
      })
      .catch((error) => {
        if (!alive) return;
        setState({
          loading: false,
          error: error?.response?.data?.error || error?.message || "Uber authorization could not be completed.",
          result: null,
        });
      });
    return () => { alive = false; };
  }, []);

  return (
    <div className="p-4 pb-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 lokin-panel p-5">
        <div className="flex items-center gap-2 text-[10px] font-display tracking-[0.2em] text-primary">
          <ShieldCheck className="h-4 w-4" /> UBER DRIVER OAUTH
        </div>
        <h1 className="mt-2 text-xl font-black font-heading metal-text">Driver Authorization</h1>

        {state.loading && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/65">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Verifying authorization and protecting the token bundle…
          </div>
        )}

        {state.error && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-red-200"><XCircle className="h-4 w-4" /> Connection not completed</div>
            <p className="mt-2 text-xs leading-relaxed text-red-100/70">{state.error}</p>
          </div>
        )}

        {state.result && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-primary"><CheckCircle2 className="h-4 w-4" /> Uber authorization stored securely</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <Metric label="Driver API verified" value={state.result.api_verified ? "yes" : "pending"} />
              <Metric label="Production approval" value={state.result.approval_state || "required"} />
              <Metric label="Token exposure" value="none" />
              <Metric label="Status" value={state.result.status || "pending"} />
            </div>
            {state.result.api_error && <p className="mt-3 text-[11px] leading-relaxed text-amber-200/80">{state.result.api_error}</p>}
          </div>
        )}

        {!state.loading && (
          <Link to="/driver-platforms" className="mt-5 flex w-full items-center justify-center rounded-2xl bg-primary py-3 text-sm font-black text-primary-foreground">
            Return to Driver Data Sources
          </Link>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
      <div className="text-[8px] uppercase tracking-wider text-white/30">{label}</div>
      <div className="mt-1 font-bold text-white/75">{String(value).replaceAll("_", " ")}</div>
    </div>
  );
}
