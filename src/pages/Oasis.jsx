import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CheckCircle2, Clock3, DollarSign, Factory, Lightbulb,
  Package, Palette, Plus, Rocket, ShieldCheck, Sparkles, Target,
  TrendingUp, X
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import OasisDesignStudio from "@/components/OasisDesignStudio";
import OasisProductization from "@/components/OasisProductization";

const STAGES = [
  { key: "idea", label: "Idea", icon: Lightbulb },
  { key: "design", label: "Design", icon: Palette },
  { key: "production_review", label: "Productize", icon: Factory },
  { key: "campaign", label: "Launch", icon: Rocket },
  { key: "profit_analysis", label: "Profit", icon: TrendingUp },
];

const FLOW = [
  "idea", "concept", "design", "brand_review", "production_review", "sample",
  "final_approval", "storefront", "campaign", "selling", "profit_analysis", "scale"
];

const STATUS_LABELS = {
  idea: "Idea",
  concept: "Concept",
  design: "Design",
  brand_review: "Brand review",
  production_review: "Production review",
  sample: "Sample",
  final_approval: "Final approval",
  storefront: "Storefront",
  campaign: "Campaign",
  selling: "Selling",
  profit_analysis: "Profit analysis",
  scale: "Scale",
  improve: "Improve",
  retired: "Retired",
};

const NEXT_ACTIONS = {
  idea: "Develop concept",
  concept: "Begin design",
  design: "Submit brand review",
  brand_review: "Approve brand direction",
  production_review: "Approve production spec",
  sample: "Approve physical sample",
  final_approval: "Approve storefront draft",
  storefront: "Approve campaign",
  campaign: "Approve launch",
  selling: "Review profit",
  profit_analysis: "Scale winning product",
  scale: "Continue scaling",
};

const EMPTY_IDEA = {
  title: "",
  idea: "",
  category: "Apparel",
  audience: "LOKIN community",
  target_price: "",
  target_margin: "60",
};

function scoreTone(score) {
  if (score >= 80) return "text-primary";
  if (score >= 60) return "text-amber-300";
  return "text-white/40";
}

function stageBucket(status) {
  const i = FLOW.indexOf(status);
  if (i <= 1) return "idea";
  if (i <= 3) return "design";
  if (i <= 7) return "production_review";
  if (i <= 9) return "campaign";
  return "profit_analysis";
}

function Score({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className={`mt-1 font-display text-lg font-black ${scoreTone(value || 0)}`}>
        {Math.round(value || 0)}
      </div>
    </div>
  );
}

function ProjectCard({ project, assets, specs, supplierCandidates, sampleRequests, advancing, analyzing, generating, reviewingId, productizing, supplierAction, onAdvance, onAnalyze, onGenerate, onReview, onProductize, onMatchSuppliers, onVerifySupplierCost, onRequestSample, onApproveSample }) {
  const [detailsOpen, setDetailsOpen] = useState(Boolean(project.director_summary));
  const approvedAsset = assets.find((asset) => asset.status === "approved");
  const latestSpec = specs[0] || null;
  const price = Number(project.target_price || 0);
  const margin = Number(project.target_margin || 0);
  const estimatedContribution = price * (margin / 100);

  return (
    <article className="rounded-2xl border border-white/10 lokin-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-display tracking-[0.18em] text-primary/75">
            {STATUS_LABELS[project.status] || project.status}
          </div>
          <h3 className="mt-1 truncate text-base font-bold text-white">{project.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">{project.idea}</p>
        </div>
        <div className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
          {project.category || "Concept"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <Score label="Brand" value={project.brand_score} />
        <Score label="Build" value={project.production_score} />
        <Score label="Demand" value={project.demand_score} />
        <Score label="Profit" value={project.profit_score} />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/35">Target economics</div>
          <div className="mt-0.5 text-xs font-semibold text-white/75">
            {price ? `$${price.toFixed(2)} retail` : "Price pending"} · {margin || 0}% margin
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-white/35">Contribution</div>
          <div className="mt-0.5 text-xs font-bold text-primary">
            {price ? `$${estimatedContribution.toFixed(2)} / unit` : "Pending"}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={analyzing}
        onClick={() => onAnalyze(project)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-black text-black disabled:opacity-50"
      >
        {analyzing ? <Clock3 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {analyzing ? "OASIS Director is analyzing…" : project.director_summary ? "Refresh Director analysis" : "Analyze with OASIS Director"}
      </button>

      {project.director_summary && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
          <button type="button" onClick={() => setDetailsOpen((open) => !open)} className="flex w-full items-center justify-between text-left">
            <span>
              <span className="block font-display text-[9px] tracking-[0.16em] text-primary">DIRECTOR BRIEF</span>
              <span className="mt-1 block text-xs font-bold text-white/80">{project.director_summary}</span>
            </span>
            <span className="ml-3 text-lg text-primary">{detailsOpen ? "−" : "+"}</span>
          </button>
          {detailsOpen && (
            <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
              {[
                ["Design direction", project.design_direction],
                ["Production plan", project.production_plan],
                ["Demand thesis", project.demand_thesis],
                ["Rights & risk review", project.risk_review],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div key={label}>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-white/35">{label}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/65">{value}</p>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-black/35 p-2"><div className="text-[8px] text-white/35">PRICE</div><div className="text-xs font-bold text-white">${Number(project.recommended_price || 0).toFixed(2)}</div></div>
                <div className="rounded-lg bg-black/35 p-2"><div className="text-[8px] text-white/35">UNIT COST</div><div className="text-xs font-bold text-white">${Number(project.estimated_unit_cost || 0).toFixed(2)}</div></div>
                <div className="rounded-lg bg-black/35 p-2"><div className="text-[8px] text-white/35">CONTRIBUTION</div><div className="text-xs font-bold text-primary">${Number(project.estimated_contribution_profit || 0).toFixed(2)}</div></div>
              </div>
              <p className="text-[9px] leading-relaxed text-white/30">AI decision support—not verified demand, legal clearance, supplier inventory, or a physical sample.</p>
            </div>
          )}
        </div>
      )}

      <OasisDesignStudio
        project={project}
        assets={assets}
        generating={generating}
        reviewingId={reviewingId}
        onGenerate={onGenerate}
        onReview={onReview}
      />

      <OasisProductization
        project={project}
        approvedAsset={approvedAsset}
        spec={latestSpec}
        candidates={supplierCandidates.filter((candidate) => candidate.product_spec_id === latestSpec?.id)}
        samples={sampleRequests.filter((sample) => sample.product_spec_id === latestSpec?.id)}
        building={productizing}
        supplierAction={supplierAction}
        onBuild={onProductize}
        onMatch={onMatchSuppliers}
        onVerifyCost={onVerifySupplierCost}
        onRequestSample={onRequestSample}
        onApproveSample={onApproveSample}
      />

      <button
        type="button"
        disabled={advancing || analyzing || Boolean(generating) || project.status === "scale" || project.status === "retired"}
        onClick={() => onAdvance(project)}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-primary/25 bg-primary/[0.07] px-3 py-2.5 text-left disabled:opacity-45"
      >
        <span>
          <span className="block text-[9px] uppercase tracking-[0.14em] text-white/35">Next controlled action</span>
          <span className="mt-0.5 block text-xs font-bold text-white/80">
            {NEXT_ACTIONS[project.status] || "Review project"}
          </span>
        </span>
        {advancing ? <Clock3 className="h-4 w-4 animate-spin text-primary" /> : <ArrowRight className="h-4 w-4 text-primary" />}
      </button>
    </article>
  );
}

export default function Oasis() {
  const [projects, setProjects] = useState([]);
  const [assets, setAssets] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [supplierCandidates, setSupplierCandidates] = useState([]);
  const [sampleRequests, setSampleRequests] = useState([]);
  const [supplierAction, setSupplierAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [idea, setIdea] = useState(EMPTY_IDEA);
  const [saving, setSaving] = useState(false);
  const [advancingId, setAdvancingId] = useState("");
  const [analyzingId, setAnalyzingId] = useState("");
  const [generatingProjectId, setGeneratingProjectId] = useState("");
  const [generatingStudy, setGeneratingStudy] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [productizingId, setProductizingId] = useState("");
  const [error, setError] = useState("");

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const user = await base44.auth.me();
      const ownerFilter = user?.role === "admin" ? {} : { owner_user_id: user?.id || "__none__" };
      const [records, designAssets, productSpecs, candidates, samples] = await Promise.all([
        base44.entities.OasisProject.filter(ownerFilter, "-created_at", 50, 0),
        base44.entities.OasisDesignAsset.filter(ownerFilter, "-created_at", 100, 0),
        base44.entities.OasisProductSpec.filter(ownerFilter, "-created_at", 100, 0),
        base44.entities.OasisSupplierCandidate.filter(ownerFilter, "-checked_at", 200, 0),
        base44.entities.OasisSampleRequest.filter(ownerFilter, "-created_at", 100, 0),
      ]);
      setProjects(records || []);
      setAssets(designAssets || []);
      setSpecs(productSpecs || []);
      setSupplierCandidates(candidates || []);
      setSampleRequests(samples || []);
    } catch (err) {
      setError("OASIS could not load its project pipeline.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  const counts = useMemo(() => {
    const result = Object.fromEntries(STAGES.map((stage) => [stage.key, 0]));
    projects.forEach((project) => {
      const bucket = stageBucket(project.status);
      result[bucket] = (result[bucket] || 0) + 1;
    });
    return result;
  }, [projects]);

  const averageProfitScore = useMemo(() => {
    if (!projects.length) return 0;
    return Math.round(projects.reduce((sum, project) => sum + Number(project.profit_score || 0), 0) / projects.length);
  }, [projects]);

  async function createIdea(event) {
    event.preventDefault();
    if (!idea.title.trim() || !idea.idea.trim()) {
      setError("Add a product name and the idea you want OASIS to develop.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const user = await base44.auth.me().catch(() => null);
      const now = new Date().toISOString();
      const record = await base44.entities.OasisProject.create({
        organization_id: user?.organization_id || user?.id || "lokin",
        owner_user_id: user?.id || "",
        title: idea.title.trim(),
        idea: idea.idea.trim(),
        category: idea.category,
        audience: idea.audience.trim(),
        target_price: Number(idea.target_price || 0),
        target_margin: Number(idea.target_margin || 0),
        status: "idea",
        approval_state: "draft",
        brand_score: 0,
        production_score: 0,
        demand_score: 0,
        profit_score: 0,
        next_action: "Develop concept",
        created_at: now,
        updated_at: now,
      });
      setProjects((current) => [record, ...current]);
      setIdea(EMPTY_IDEA);
      setComposerOpen(false);
    } catch (err) {
      setError("The idea was not saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function analyzeProject(project) {
    setAnalyzingId(project.id);
    setError("");
    try {
      const response = await base44.functions.invoke("external-ai-gateway", {
        mode: "oasis",
        command: JSON.stringify({
          project_id: project.id,
          title: project.title,
          idea: project.idea,
          category: project.category,
          audience: project.audience,
          target_price: Number(project.target_price || 0),
          target_margin: Number(project.target_margin || 0),
        }),
      });
      const result = response?.data || response || {};
      const user = await base44.auth.me().catch(() => null);
      const now = new Date().toISOString();

      if (result.analysis_status === "setup_required" || result.configured === false) {
        await base44.entities.OasisDirectorRun.create({
          organization_id: project.organization_id || user?.organization_id || user?.id || "lokin",
          owner_user_id: user?.id || "",
          project_id: project.id,
          run_status: "setup_required",
          output_json: JSON.stringify({ message: result.director_summary || "Provider setup required" }),
          provider: result.provider || "local-fallback",
          model: "",
          input_tokens: 0,
          output_tokens: 0,
          estimated_cost_usd: 0,
          guardian_mode: result.guardian?.mode || "normal",
          created_at: now,
        });
        setError(result.director_summary || "OASIS Director provider setup is required. Your project was not changed.");
        return;
      }

      const clampScore = (value) => Math.max(0, Math.min(100, Number(value || 0)));
      const update = {
        director_summary: String(result.director_summary || "").slice(0, 1400),
        design_direction: String(result.design_direction || "").slice(0, 1800),
        production_plan: String(result.production_plan || "").slice(0, 1800),
        demand_thesis: String(result.demand_thesis || "").slice(0, 1800),
        risk_review: String(result.risk_review || "").slice(0, 1800),
        brand_score: clampScore(result.brand_score),
        production_score: clampScore(result.production_score),
        demand_score: clampScore(result.demand_score),
        profit_score: clampScore(result.profit_score),
        recommended_price: Math.max(0, Number(result.recommended_price || 0)),
        estimated_unit_cost: Math.max(0, Number(result.estimated_unit_cost || 0)),
        estimated_contribution_profit: Number(result.estimated_contribution_profit || 0),
        director_provider: result.provider || "external",
        director_model: result.model || "",
        director_analyzed_at: now,
        status: project.status === "idea" ? "concept" : project.status,
        next_action: String(result.next_action || "Review Director brief").slice(0, 500),
        updated_at: now,
      };

      const updated = await base44.entities.OasisProject.update(project.id, update);
      await base44.entities.OasisDirectorRun.create({
        organization_id: project.organization_id || user?.organization_id || user?.id || "lokin",
        owner_user_id: user?.id || "",
        project_id: project.id,
        run_status: "completed",
        output_json: JSON.stringify(result).slice(0, 12000),
        provider: result.provider || "external",
        model: result.model || "",
        input_tokens: Number(result.usage?.input_tokens || 0),
        output_tokens: Number(result.usage?.output_tokens || 0),
        estimated_cost_usd: Number(result.usage?.estimated_cost_usd || 0),
        guardian_mode: result.guardian?.mode || "normal",
        created_at: now,
      });
      setProjects((current) => current.map((item) => item.id === project.id ? updated : item));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "OASIS Director analysis failed.";
      setError(`${message} Your saved project remains unchanged.`);
    } finally {
      setAnalyzingId("");
    }
  }

  async function generateDesign(project, studyType, colorway) {
    const approved = window.confirm(`Generate a ${studyType.replaceAll("_", " ")} for ${project.title}? This uses image-generation credits and creates a review-stage mockup.`);
    if (!approved) return;

    setGeneratingProjectId(project.id);
    setGeneratingStudy(studyType);
    setError("");
    try {
      const response = await base44.functions.invoke("oasis-design-studio", {
        projectId: project.id,
        studyType,
        colorway,
      });
      const result = response?.data || response || {};
      if (!result.asset) throw new Error("The image provider returned no design asset.");
      setAssets((current) => [result.asset, ...current]);
      if (result.project) setProjects((current) => current.map((item) => item.id === project.id ? result.project : item));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "OASIS Design Studio generation failed.";
      setError(`${message} No asset was approved or sent to production.`);
    } finally {
      setGeneratingProjectId("");
      setGeneratingStudy("");
    }
  }

  async function reviewDesign(asset, decision) {
    setReviewingId(asset.id);
    setError("");
    try {
      const user = await base44.auth.me().catch(() => null);
      const now = new Date().toISOString();
      const assetUpdate = {
        status: decision,
        review_note: decision === "approved"
          ? "Creative direction approved; rights and production clearance remain pending."
          : "Rejected during creative review; retained in version history.",
        production_ready: false,
      };
      if (decision === "approved") assetUpdate.approved_at = now;
      const updated = await base44.entities.OasisDesignAsset.update(asset.id, assetUpdate);
      await base44.entities.OasisApproval.create({
        organization_id: asset.organization_id || user?.organization_id || user?.id || "lokin",
        project_id: asset.project_id,
        gate: "brand",
        decision,
        reviewer_user_id: user?.id || "",
        note: `Design asset ${asset.name} ${decision}. This decision does not grant rights or production clearance.`,
        decided_at: now,
      });
      setAssets((current) => current.map((item) => item.id === asset.id ? updated : item));
      if (decision === "approved") {
        const project = projects.find((item) => item.id === asset.project_id);
        if (project) {
          const updatedProject = await base44.entities.OasisProject.update(project.id, {
            status: "design",
            approval_state: "needs_review",
            next_action: "Submit approved concept for Brand DNA, rights, and production review",
            updated_at: now,
          });
          setProjects((current) => current.map((item) => item.id === project.id ? updatedProject : item));
        }
      }
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Design review failed.";
      setError(`${message} The previous review state remains in effect.`);
    } finally {
      setReviewingId("");
    }
  }

  async function productizeProject(project) {
    const approved = window.confirm(`Create a draft product specification for ${project.title}? This creates no supplier order and publishes nothing.`);
    if (!approved) return;

    setProductizingId(project.id);
    setError("");
    try {
      const response = await base44.functions.invoke("oasis-productization", { projectId: project.id });
      const result = response?.data || response || {};
      if (!result.spec) throw new Error("Productization returned no specification.");
      setSpecs((current) => [result.spec, ...current]);
      setSupplierCandidates((current) => [...(result.candidates || []), ...current]);
      if (result.project) setProjects((current) => current.map((item) => item.id === project.id ? result.project : item));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "OASIS Productization failed.";
      setError(`${message} No supplier order or storefront change was made.`);
    } finally {
      setProductizingId("");
    }
  }

  async function matchSuppliers(project) {
    const approved = window.confirm(`Read the connected Printful and Printify catalogs for ${project.title}? This is read-only and creates no supplier product or order.`);
    if (!approved) return;

    setSupplierAction("matching");
    setError("");
    try {
      const response = await base44.functions.invoke("oasis-supplier-control", {
        action: "match",
        projectId: project.id,
      });
      const result = response?.data || response || {};
      setSupplierCandidates((current) => {
        const changed = new Set((result.candidates || []).map((item) => item.id));
        return [...(result.candidates || []), ...current.filter((item) => !changed.has(item.id))];
      });
      if (result.project) setProjects((current) => current.map((item) => item.id === project.id ? result.project : item));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Live supplier matching failed.";
      setError(`${message} Nothing was ordered or changed at either supplier.`);
    } finally {
      setSupplierAction("");
    }
  }

  async function verifySupplierCost(candidate) {
    const baseInput = window.prompt(`Confirmed base product cost for ${candidate.supplier} ${candidate.product_title || candidate.supplier_product_id}:`);
    if (baseInput === null) return;
    const shippingInput = window.prompt("Confirmed per-unit shipping or allocation:", "0");
    if (shippingInput === null) return;
    const baseCost = Number(baseInput);
    const shipping = Number(shippingInput);
    if (!Number.isFinite(baseCost) || baseCost <= 0 || !Number.isFinite(shipping) || shipping < 0) {
      setError("Enter a positive base cost and non-negative shipping amount.");
      return;
    }
    const approved = window.confirm(`Confirm landed cost $${(baseCost + shipping).toFixed(2)}? This value is user-confirmed, not a supplier quote.`);
    if (!approved) return;

    setSupplierAction("cost");
    setError("");
    try {
      const response = await base44.functions.invoke("oasis-supplier-control", {
        action: "verify_cost",
        candidateId: candidate.id,
        baseCost,
        shipping,
      });
      const result = response?.data || response || {};
      if (result.candidate) {
        setSupplierCandidates((current) => current.map((item) => item.id === result.candidate.id ? result.candidate : item));
      }
      if (result.project) setProjects((current) => current.map((item) => item.id === result.project.id ? result.project : item));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Landed cost could not be confirmed.");
    } finally {
      setSupplierAction("");
    }
  }

  async function requestSample(candidate) {
    const approved = window.confirm(`Create a one-unit sample approval request for ${candidate.supplier}? This will not place an order or make a payment.`);
    if (!approved) return;

    setSupplierAction("sample");
    setError("");
    try {
      const response = await base44.functions.invoke("oasis-supplier-control", {
        action: "request_sample",
        candidateId: candidate.id,
      });
      const result = response?.data || response || {};
      if (result.sample) {
        setSampleRequests((current) => [result.sample, ...current.filter((item) => item.id !== result.sample.id)]);
      }
      if (result.project) setProjects((current) => current.map((item) => item.id === result.project.id ? result.project : item));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Sample approval request could not be created.");
    } finally {
      setSupplierAction("");
    }
  }

  async function approveSample(sample) {
    const approved = window.confirm("Approve this sample request for planning? This still will not place a supplier order or make a payment.");
    if (!approved) return;

    setSupplierAction("approval");
    setError("");
    try {
      const response = await base44.functions.invoke("oasis-supplier-control", {
        action: "approve_sample",
        sampleRequestId: sample.id,
      });
      const result = response?.data || response || {};
      if (result.sample) {
        setSampleRequests((current) => current.map((item) => item.id === result.sample.id ? result.sample : item));
      }
      if (result.project) setProjects((current) => current.map((item) => item.id === result.project.id ? result.project : item));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Sample approval failed.");
    } finally {
      setSupplierAction("");
    }
  }

  async function advanceProject(project) {
    const currentIndex = FLOW.indexOf(project.status);
    if (currentIndex < 0 || currentIndex >= FLOW.length - 1) return;
    const nextStatus = FLOW[currentIndex + 1];
    const controlledGate = ["brand_review", "production_review", "sample", "final_approval", "storefront", "campaign"];
    const nextApprovalState = controlledGate.includes(nextStatus) ? "needs_review" : "draft";

    setAdvancingId(project.id);
    setError("");
    try {
      const updated = await base44.entities.OasisProject.update(project.id, {
        status: nextStatus,
        approval_state: nextApprovalState,
        next_action: NEXT_ACTIONS[nextStatus] || "Review project",
        updated_at: new Date().toISOString(),
      });
      setProjects((current) => current.map((item) => item.id === project.id ? updated : item));
    } catch (err) {
      setError("OASIS could not advance this project. No stage was skipped.");
    } finally {
      setAdvancingId("");
    }
  }

  return (
    <div className="space-y-5 p-4 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 lokin-panel radial-fade p-5">
        <div className="absolute inset-0 brand-grid opacity-25" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-display text-[9px] tracking-[0.2em] text-primary">CREATIVE COMMERCE OS</span>
            </div>
            <ShieldCheck className="h-5 w-5 text-primary/70" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-white">
            LOKIN <span className="text-primary text-glow">OASIS</span>
          </h1>
          <p className="mt-1 text-xs font-semibold tracking-[0.08em] text-white/55">
            ORIGINALITY · ARTISTRY · STRATEGY · INTELLIGENCE · SCALE
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            Where imagination becomes enterprise. Move every LOKIN idea through design,
            production, launch, and measurable contribution profit.
          </p>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-black shadow-[0_0_24px_rgba(170,255,0,0.22)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Plant an idea
          </button>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <div>
            <div className="font-display text-[10px] tracking-[0.2em] text-white/40">IDEA → PROFIT</div>
            <h2 className="mt-1 text-base font-bold text-white">OASIS pipeline</h2>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-white/35">Profit signal</div>
            <div className="font-display text-lg font-black text-primary">{averageProfitScore}</div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="rounded-xl border border-white/10 bg-white/[0.025] px-1 py-2 text-center">
                <Icon className="mx-auto h-4 w-4 text-primary/75" />
                <div className="mt-1 font-display text-sm font-black text-white">{counts[stage.key] || 0}</div>
                <div className="mt-0.5 truncate text-[8px] uppercase tracking-tight text-white/35">{stage.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[
          { icon: Target, label: "Brand DNA", value: "Protected" },
          { icon: Package, label: "Products", value: projects.length },
          { icon: DollarSign, label: "Profit truth", value: "On" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 lokin-panel p-3">
            <item.icon className="h-4 w-4 text-primary" />
            <div className="mt-3 text-[9px] uppercase tracking-wider text-white/35">{item.label}</div>
            <div className="mt-0.5 truncate text-xs font-bold text-white/80">{item.value}</div>
          </div>
        ))}
      </section>

      {error && (
        <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Active creations</h2>
          <span className="text-[10px] text-white/35">{projects.length} total</span>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]" />)}
          </div>
        ) : projects.length ? (
          <div className="space-y-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                assets={assets.filter((asset) => asset.project_id === project.id)}
                specs={specs.filter((spec) => spec.project_id === project.id)}
                supplierCandidates={supplierCandidates.filter((candidate) => candidate.project_id === project.id)}
                sampleRequests={sampleRequests.filter((sample) => sample.project_id === project.id)}
                advancing={advancingId === project.id}
                analyzing={analyzingId === project.id}
                generating={generatingProjectId === project.id ? generatingStudy : ""}
                reviewingId={reviewingId}
                productizing={productizingId === project.id}
                supplierAction={supplierAction}
                onAdvance={advanceProject}
                onAnalyze={analyzeProject}
                onGenerate={generateDesign}
                onReview={reviewDesign}
                onProductize={productizeProject}
                onMatchSuppliers={matchSuppliers}
                onVerifySupplierCost={verifySupplierCost}
                onRequestSample={requestSample}
                onApproveSample={approveSample}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.035] p-6 text-center">
            <Lightbulb className="mx-auto h-7 w-7 text-primary" />
            <h3 className="mt-3 text-sm font-bold text-white">Your first creation starts here</h3>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-white/45">
              Capture the product idea before it disappears. OASIS will preserve it inside the controlled design-to-profit pipeline.
            </p>
          </div>
        )}
      </section>

      {composerOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/75 backdrop-blur-sm">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border-t border-primary/25 bg-[#080a0c] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[10px] tracking-[0.2em] text-primary">OASIS IDEA LAB</div>
                  <h2 className="mt-1 text-xl font-bold text-white">Plant a new idea</h2>
                </div>
                <button type="button" onClick={() => setComposerOpen(false)} className="rounded-full border border-white/10 p-2 text-white/55">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={createIdea} className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-white/65">Product or collection name</span>
                  <input value={idea.title} onChange={(e) => setIdea({ ...idea, title: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-primary/60"
                    placeholder="Captain LOKIN Night Rider Jacket" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-white/65">Describe the idea</span>
                  <textarea value={idea.idea} onChange={(e) => setIdea({ ...idea, idea: e.target.value })}
                    className="mt-1 min-h-28 w-full resize-none rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-primary/60"
                    placeholder="What should exist, who is it for, and why will they want it?" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="text-xs font-semibold text-white/65">Category</span>
                    <select value={idea.category} onChange={(e) => setIdea({ ...idea, category: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none">
                      {["Apparel", "Driver gear", "Accessory", "Technology", "Packaging", "Media", "Other"].map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-white/65">Audience</span>
                    <input value={idea.audience} onChange={(e) => setIdea({ ...idea, audience: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none" />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-white/65">Target price</span>
                    <input type="number" min="0" step="0.01" value={idea.target_price} onChange={(e) => setIdea({ ...idea, target_price: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none" placeholder="$0.00" />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-white/65">Target margin</span>
                    <input type="number" min="0" max="100" value={idea.target_margin} onChange={(e) => setIdea({ ...idea, target_margin: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none" />
                  </label>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <CheckCircle2 className="h-4 w-4" /> Controlled creation
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                    Saving an idea does not publish, manufacture, purchase, or spend. Human approval remains required at every external commitment gate.
                  </p>
                </div>

                <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-black disabled:opacity-50">
                  {saving ? <Clock3 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {saving ? "Planting idea…" : "Create OASIS project"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
