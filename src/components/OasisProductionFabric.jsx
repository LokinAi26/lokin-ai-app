import { useEffect, useState } from "react";
import { Boxes, CheckCircle2, Clock3, Cpu, RefreshCw, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";

const FALLBACK_RECIPES = [
  { key: "vector_brand_asset", name: "Vector Brand Asset", domain: "vector", provider_key: "recraft", setup_status: "setup_required" },
  { key: "apparel_digital_twin", name: "Apparel Digital Twin", domain: "apparel", provider_key: "clo_desktop_bridge", setup_status: "setup_required" },
  { key: "commercial_keyframe_pipeline", name: "Commercial Keyframe Pipeline", domain: "video", provider_key: "lokin_productions", setup_status: "setup_required" },
  { key: "mastering_package", name: "Mastering Package", domain: "mastering", provider_key: "davinci_bridge", setup_status: "setup_required" },
];

function title(value) {
  return String(value || "").replaceAll("_", " ");
}

export default function OasisProductionFabric({ project, sourceAsset }) {
  const [recipes, setRecipes] = useState(FALLBACK_RECIPES);
  const [busyKey, setBusyKey] = useState("");
  const [jobs, setJobs] = useState({});
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [healthMessage, setHealthMessage] = useState("");

  useEffect(() => {
    let active = true;
    base44.functions.invoke("oasis-production-fabric", { action: "list_recipes" })
      .then((response) => {
        const result = response?.data || response || {};
        if (active && Array.isArray(result.recipes) && result.recipes.length) setRecipes(result.recipes);
      })
      .catch(() => {
        // The static catalog keeps the control surface truthful if the function is temporarily unavailable.
      });
    return () => { active = false; };
  }, []);

  async function refreshProviderHealth() {
    setRefreshing(true);
    setError("");
    setHealthMessage("");
    try {
      const healthResponse = await base44.functions.invoke("oasis-provider-health", {});
      const healthResult = healthResponse?.data || healthResponse || {};
      const catalogResponse = await base44.functions.invoke("oasis-production-fabric", { action: "list_recipes" });
      const catalogResult = catalogResponse?.data || catalogResponse || {};
      if (Array.isArray(catalogResult.recipes) && catalogResult.recipes.length) setRecipes(catalogResult.recipes);
      const readyCount = Array.isArray(healthResult.providers)
        ? healthResult.providers.filter((provider) => provider.setup_status === "configured" && provider.health_status === "healthy").length
        : 0;
      setHealthMessage(`${readyCount} of 2 live adapters healthy. Health checks do not generate media or spend credits.`);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Provider health check failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function compile(recipe) {
    const confirmed = window.confirm(
      `Compile ${recipe.name} for ${project.title}? This creates a guarded workflow job only. It will not generate media, spend credits, publish, manufacture, or order anything.`,
    );
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
      setJobs((current) => ({ ...current, [recipe.key]: result.job }));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Production Fabric could not compile this workflow.");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.035] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-display text-[9px] tracking-[0.16em] text-cyan-300">
            <Boxes className="h-3.5 w-3.5" /> OASIS PRODUCTION FABRIC
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            Compile repeatable, auditable production graphs. Providers remain fail-closed until configured, healthy, approved, and cleared by Credit Guardian.
          </p>
        </div>
        <button
          type="button"
          disabled={refreshing || Boolean(busyKey)}
          onClick={refreshProviderHealth}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300/20 px-2 py-1.5 text-[8px] font-bold uppercase tracking-wider text-cyan-200 transition hover:border-cyan-300/50 disabled:opacity-50"
          title="Run zero-spend provider health checks"
        >
          {refreshing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Health
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {recipes.map((recipe) => {
          const job = jobs[recipe.key];
          const busy = busyKey === recipe.key;
          const status = job?.status || recipe.setup_status || "setup_required";
          return (
            <button
              key={recipe.key}
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => compile(recipe)}
              className="rounded-xl border border-white/10 bg-black/35 p-3 text-left transition hover:border-cyan-300/35 disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <Cpu className="h-4 w-4 text-cyan-300" />
                {busy ? <Clock3 className="h-3.5 w-3.5 animate-spin text-cyan-300" /> : job ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : null}
              </div>
              <div className="mt-2 text-[11px] font-bold text-white/80">{recipe.name}</div>
              <div className="mt-1 text-[8px] uppercase tracking-wider text-white/35">{title(recipe.domain)} · {title(recipe.provider_key)}</div>
              <div className={`mt-2 text-[9px] font-bold uppercase tracking-wider ${status === "setup_required" ? "text-amber-300" : "text-primary"}`}>
                {title(status)}
              </div>
              <div className="mt-1 text-[8px] uppercase tracking-wider text-white/30">
                Health: {title(recipe.health_status || "unknown")}
              </div>
            </button>
          );
        })}
      </div>

      {healthMessage && <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-[10px] text-cyan-100/70">{healthMessage}</div>}
      {error && <div className="mt-3 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-[10px] text-red-200">{error}</div>}
      <p className="mt-3 text-[9px] leading-relaxed text-white/30">
        Compiling is zero-spend. Execution requires provider activation, rights clearance, human approval, and a separate cost reservation.
      </p>
    </section>
  );
}
