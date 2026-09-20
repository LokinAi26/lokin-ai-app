import { useState } from "react";
import { base44 } from "@/api/base44Client";

const STATUS_STYLES = {
  planned: "border-white/15 text-white/60",
  awaiting_approval: "border-amber-400/50 text-amber-300",
  in_progress: "border-primary/60 text-primary",
  blocked: "border-red-400/40 text-red-300",
  completed: "border-primary/40 text-primary/75",
  cancelled: "border-white/10 text-white/35",
  archived: "border-white/10 text-white/35",
};

function parseSteps(raw) {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function PlanList({ plans, onChanged }) {
  const [busyId, setBusyId] = useState("");
  const [openId, setOpenId] = useState("");

  async function complete(planId) {
    setBusyId(planId);
    try {
      await base44.functions.invoke("lokin-l3-dispatch", { action: "complete", plan_id: planId });
      onChanged?.();
    } finally {
      setBusyId("");
    }
  }

  if (!plans.length) {
    return (
      <div className="rounded-3xl border border-dashed border-lokin-neon/40 bg-black/50 p-5 text-center">
        <div className="text-sm font-bold text-white/75">No plans yet</div>
        <div className="mt-1 text-[11px] text-white/40">Dispatch a directive above — LOKIN opens a plan with a checklist and starts the run log.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {plans.map((plan) => {
        const steps = parseSteps(plan.steps_json);
        const open = openId === plan.id;
        const completable = ["planned", "in_progress"].includes(plan.status);
        return (
          <div key={plan.id} className="lokin-card p-3">
            <div className="flex items-start justify-between gap-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? "" : plan.id)}>
                <div className="truncate text-sm font-bold text-white">{plan.title || plan.goal}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-[0.1em] ${STATUS_STYLES[plan.status] || STATUS_STYLES.planned}`}>
                    {(plan.status || "").replace("_", " ").toUpperCase()}
                  </span>
                  <span className="text-[10px] text-white/40">{plan.classification}</span>
                  {plan.checkpoint_class && plan.checkpoint_class !== "none" && (
                    <span className="text-[10px] font-bold text-amber-300">· {plan.checkpoint_class}</span>
                  )}
                </div>
              </button>
              {completable && (
                <button onClick={() => complete(plan.id)} disabled={busyId === plan.id} className="min-h-11 shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-3 text-[10px] font-extrabold tracking-[0.08em] text-primary active:scale-95 disabled:opacity-50">
                  {busyId === plan.id ? "…" : "MARK DONE"}
                </button>
              )}
            </div>
            {open && steps.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-white/8 pt-2">
                {steps.map((step) => (
                  <div key={step.order} className="text-[11px]">
                    <span className="font-bold text-primary/80">{step.order}. {step.name}</span>
                    <span className="text-white/40"> — {step.purpose}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}