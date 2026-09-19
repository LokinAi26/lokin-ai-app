import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Radar } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DirectiveBar from "@/components/l3/DirectiveBar";
import ApprovalCard from "@/components/l3/ApprovalCard";
import PlanList from "@/components/l3/PlanList";
import ShakedownPanel from "@/components/l3/ShakedownPanel";
import ScheduleList from "@/components/l3/ScheduleList";

export default function L3Ops() {
  const [params] = useSearchParams();
  const mode = ["x10", "productivity", "rootcause", "debug", "automate"].includes(params.get("mode")) ? params.get("mode") : "";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await base44.functions.invoke("lokin-l3-dispatch", { action: "overview" });
    setData(res.data);
  }, []);

  useEffect(() => {
    load()
      .catch(() => setError("The L3 dispatcher did not respond."))
      .finally(() => setLoading(false));
  }, [load]);

  const refresh = () => load().catch(() => {});

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-accent" />
        <div>
          <h1 className="lokin-wordmark text-xl font-bold font-heading leading-none tracking-[0.04em]">L3 OPS</h1>
          <div className="lokin-kicker lokin-kicker-cyan mt-1">OPERATING LAYER · $0 SPEND CAP</div>
        </div>
      </div>

      <DirectiveBar mode={mode} onDispatched={refresh} />

      <section className="space-y-2">
        <div className="lokin-kicker">APPROVAL CARDS · TTL 30 MIN · DEFAULT-DENY</div>
        {loading && <div className="text-[11px] text-white/40">Loading operating state…</div>}
        {error && <div className="text-[11px] text-red-300">{error}</div>}
        {!loading && !error && (data?.pending_approvals || []).length === 0 && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/40">
            No approvals waiting. Checkpoint-class actions (destructive, financial, public, credential, irreversible) pause here for your card.
          </div>
        )}
        {(data?.pending_approvals || []).map((approval) => (
          <ApprovalCard key={approval.id} approval={approval} onDecided={refresh} />
        ))}
      </section>

      <ShakedownPanel onDone={refresh} />

      <section className="space-y-2">
        <div className="lokin-kicker">PLANS</div>
        <PlanList plans={data?.plans || []} onChanged={refresh} />
      </section>

      <section className="space-y-2">
        <div className="lokin-kicker">SCHEDULES · SIX-FIELD CONTRACT</div>
        <ScheduleList schedules={data?.schedules || []} onChanged={refresh} />
      </section>

      {(data?.runs || []).length > 0 && (
        <section className="space-y-2">
          <div className="lokin-kicker">RUN LOG · APPEND-ONLY</div>
          {(data.runs || []).map((run) => (
            <div key={run.id} className="lokin-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-[11px] font-bold text-white/70">RUN {String(run.id).slice(0, 8)}</div>
                <span className={`text-[9px] font-extrabold tracking-[0.1em] ${run.status === "open" ? "text-primary" : "text-white/35"}`}>{run.status.toUpperCase()}</span>
              </div>
              <div className="mt-1.5 space-y-1">
                {(run.entries || []).map((entry, i) => (
                  <div key={i} className="text-[10px] text-white/45">
                    <span className="text-white/25">{entry.at ? new Date(entry.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""} </span>
                    {entry.entry}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}