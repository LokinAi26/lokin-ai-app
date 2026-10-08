import { useMemo, useState } from "react";
import { Boxes, CheckCircle2, ChevronDown, Clock3, Cpu, RefreshCw, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Shown only until the live catalog loads, or if the catalog function is unreachable.
export const FALLBACK_RECIPES = [
  { key: "vector_brand_asset", name: "Vector Brand Asset", domain: "vector", provider_key: "recraft", setup_status: "setup_required" },
  { key: "apparel_digital_twin", name: "Apparel Digital Twin", domain: "apparel", provider_key: "clo_desktop_bridge", setup_status: "setup_required" },
  { key: "commercial_keyframe_pipeline", name: "Commercial Keyframe Pipeline", domain: "video", provider_key: "lokin_productions", setup_status: "setup_required" },
  { key: "mastering_package", name: "Mastering Package", domain: "mastering", provider_key: "davinci_bridge", setup_status: "setup_required" },
];

const STATUS_TONE = {
  completed: "text-primary",
  awaiting_approval: "text-cyan-300",
  queued: "text-cyan-300",
  running: "text-cyan-300",
  qc: "text-cyan-300",
  configured: "text-primary",
  setup_required: "text-amber-300",
  degraded: "text-amber-300",
  blocked: "text-red-300",
  failed: "text-red-300",
  cancelled: "text-white/40",
  disabled: "text-white/40",
};

const HEALTH_DOT = {
  healthy: "bg-primary",
  degraded: "bg-amber-300",
  offline: "bg-red-400",
  unknown: "bg-white/25",
};

function title(value) {
  return String(value || "").replaceAll("_", " ");
}

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function OasisProductionFabric({ project, sourceAsset, recipes, jobs, confirm, onJobSaved, onRecipesChange }) {
  const [open, setOpen] = useState(Boolean(jobs?.length));
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [healthMessage, setHealthMessage] = useState("");

  // Latest persisted job per workflow, so compiled work survives reloads.
  const jobByKey = useMemo(() => {
    const map = {};
    for (const job of jobs || []) {
      const current = map[job.workflow_key];
      if (!current || String(job.created_at || "") > String(current.created_at || "")) map[job.workflow_key] = job;
    }
    return map;
  }, [jobs]);

  const list = recipes?.length ? recipes : FALLBACK_RECIPES;
  const readyCount = list.filter((recipe) => recipe.executable).length;

  async function refreshProviderHealth() {
    setRefreshing(true);
    setError("");
    setHealthMessage("");
    try {
      const healthResponse = await base44.functions.invoke("oasis-provider-health", {});
      const healthResult = healthResponse?.data || healthResponse || {};
      const providers = Array.isArray(healthResult.providers) ? healthResult.providers : [];
      const healthy = providers.filter((provider) => provider.setup_status === "configured" && provider.health_status === "healthy").length;
      await onRecipesChange?.();
      setHealthMessage(`${healthy} of ${providers.length} live adapter${providers.length === 1 ? "" : "s"} healthy. Health checks do not generate media or spend credits.`);
    } catch (err) {
      setError(errorMessage(err, "Provider health check failed."));
    } finally {
      setRefreshing(false);
    }
  }

  async function compile(recipe) {
    const existing = jobByKey[recipe.key];
    const confirmed = await confirm({
      title: existing ? `Recheck ${recipe.name}?` : `Compile ${recipe.name}?`,
      body: `For ${project.title}. This ${existing ? "reconciles the existing job against live provider health" : "creates a guarded workflow job"} only. It will not generate media, spend credits, publish, manufacture, or order anything.`,
      confirmLabel: existing ? "Recheck" : "Compile",
    });
    if (!confirmed) return;

    setBusyKey(recipe.key);
    setError("");
    try {
      const response = await base44.functions.invoke("oasis-production-fabric", {
        action: "compile",
        projectId: project.id,
        workflowKey: recipe.key,
        sourceAssetId: sourceAsset?.id || "",
        requestKey: `${recipe.key}:${sourceAsset?.id || "project"}`,
      });
      const result = response?.data || response || {};
      if (!result.job) throw new Error("Workflow compiler returned no job.");
      onJobSaved?.(result.job);
    } catch (err) {
      setError(errorMessage(err, "Production Fabric could not compile this workflow."));
    } finally {
      setBusyKey("");
    }
  }

  const compiledCount = Object.keys(jobByKey).length;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-cyan-300/20 bg-cyan-300/[0.035]">
      <div className="flex items-center justify-between gap-2 p-3">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10">
            <Boxes className="h-4 w-4 text-cyan-300" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[9px] tracking-[0.16em] text-cyan-300">OASIS PRODUCTION FABRIC</span>
            <span className="mt-0.5 block truncate text-xs font-bold text-white/80">
              {compiledCount} of {list.length} compiled · {readyCount} provider{readyCount === 1 ? "" : "s"} ready
            </span>
          </span>
          <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-cyan-300 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          disabled={refreshing || Boolean(busyKey)}
          onClick={refreshProviderHealth}
          className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300/20 px-2.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200 transition hover:border-cyan-300/50 disabled:opacity-50"
          title="Run zero-spend provider health checks"
        >
          {refreshing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Health
        </button>
      </div>

      {healthMessage && <div role="status" className="mx-3 mb-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-[10px] text-cyan-100/70">{healthMessage}</div>}
      {error && <div role="alert" className="mx-3 mb-3 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-[10px] text-red-200">{error}</div>}

      {open && (
        <div className="border-t border-white/10 p-3">
          <div className="grid grid-cols-2 gap-2">
            {list.map((recipe) => {
              const job = jobByKey[recipe.key];
              const busy = busyKey === recipe.key;
              const status = job?.status || recipe.setup_status || "setup_required";
              const health = recipe.health_status || "unknown";
              return (
                <button
                  key={recipe.key}
                  type="button"
                  disabled={Boolean(busyKey)}
                  onClick={() => compile(recipe)}
                  className="rounded-xl border border-white/10 bg-black/35 p-3 text-left transition hover:border-cyan-300/35 active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Cpu className="h-4 w-4 text-cyan-300" />
                    {busy ? <Clock3 className="h-3.5 w-3.5 animate-spin text-cyan-300" /> : job ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : null}
                  </div>
                  <div className="mt-2 text-[11px] font-bold leading-tight text-white/80">{recipe.name}</div>
                  <div className="mt-1 truncate text-[8px] uppercase tracking-wider text-white/35">{title(recipe.domain)} · {title(recipe.provider_key)}</div>
                  <div className={`mt-2 text-[9px] font-bold uppercase tracking-wider ${STATUS_TONE[status] || "text-white/60"}`}>
                    {job ? `Job · ${title(status)}` : title(status)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[8px] uppercase tracking-wider text-white/35">
                    <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[health] || HEALTH_DOT.unknown}`} />
                    {title(health)}
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-cyan-200/80">{busy ? "Working…" : job ? "Recheck" : "Compile"}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[9px] leading-relaxed text-white/30">
            Compiling is zero-spend. Execution requires provider activation, rights clearance, human approval, and a separate cost reservation.
          </p>
        </div>
      )}
    </section>
  );
}
