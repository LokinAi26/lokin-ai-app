import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function PrintfulCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("processing");
  const [store, setStore] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const code = params.get("code");
      const st = params.get("state");
      const success = params.get("success");
      try {
        const res = await base44.functions.invoke("printful-oauth-callback", { code, state: st, success });
        const data = res.data;
        if (data.connected) {
          setStore(data.store);
          setPhase("success");
        } else {
          setError(data.error || "Connection failed.");
          setPhase("error");
        }
      } catch (e) {
        setError(e.response?.data?.error || e.message);
        setPhase("error");
      }
    })();
  }, []);

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      {phase === "processing" && (
        <>
          <Loader2 className="h-10 w-10 text-accent animate-spin" />
          <div className="text-sm text-white/60">Connecting your Printful account…</div>
        </>
      )}
      {phase === "success" && (
        <>
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <div className="font-display text-lg font-bold text-primary text-glow">PRINTFUL CONNECTED</div>
          <div className="text-sm text-white/60">{store?.name ? `Store: ${store.name}` : "Your account is now linked."}</div>
          <button onClick={() => navigate("/printful-connect")} className="rounded-2xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold glow-primary">Continue</button>
        </>
      )}
      {phase === "error" && (
        <>
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div className="font-display text-lg font-bold text-destructive">CONNECTION FAILED</div>
          <div className="text-sm text-white/60 max-w-xs">{error}</div>
          <button onClick={() => navigate("/printful-connect")} className="rounded-2xl border border-white/15 px-6 py-2.5 text-sm text-white/70">Back</button>
        </>
      )}
    </div>
  );
}