import { createClientFromRequest } from "npm:@base44/sdk";

const STUDIES = {
  product_concept: {
    assetType: "mockup",
    name: "Product concept",
    direction: "Create a premium photoreal product-design presentation showing the complete product, front three-quarter view, material details, functional features, and a clean secondary detail view.",
  },
  colorway: {
    assetType: "graphic",
    name: "Colorway study",
    direction: "Create a professional product colorway presentation with three coordinated variations of the same approved design, consistent construction, clear material separation, and no unrelated redesign.",
  },
  packaging: {
    assetType: "packaging",
    name: "Packaging study",
    direction: "Create premium retail packaging and unboxing presentation for the product, including exterior package, interior reveal, label system, and protective components.",
  },
  campaign: {
    assetType: "campaign",
    name: "Campaign key art",
    direction: "Create cinematic commercial key art featuring the product as the hero, with controlled dramatic lighting, premium composition, and generous safe space for campaign copy.",
  },
};

function clean(value, max = 1800) {
  return String(value || "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const projectId = clean(body.projectId, 120);
    const studyKey = clean(body.studyType, 40);
    const colorway = clean(body.colorway || "Vault Black, LOKIN Neon Lime #AAFF00, and AI Cyan #06D9F9", 180);
    const study = STUDIES[studyKey];

    if (!projectId) return Response.json({ error: "Project ID is required" }, { status: 400 });
    if (!study) return Response.json({ error: "Unsupported design study" }, { status: 400 });

    const project = await base44.asServiceRole.entities.OasisProject.get(projectId);
    if (!project) return Response.json({ error: "OASIS project not found" }, { status: 404 });
    if (project.owner_user_id && project.owner_user_id !== user.id && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!project.director_summary || !project.design_direction) {
      return Response.json({ error: "Run OASIS Director before generating design studies" }, { status: 409 });
    }

    const prompt = [
      "LOKIN OASIS Design Studio — controlled concept mockup, not a manufactured sample.",
      study.direction,
      `Product name: ${clean(project.title, 240)}.`,
      `Product idea: ${clean(project.idea)}.`,
      `Category: ${clean(project.category, 120)}.`,
      `Audience: ${clean(project.audience, 240)}.`,
      `OASIS Director brief: ${clean(project.director_summary)}.`,
      `Approved design direction: ${clean(project.design_direction)}.`,
      `Colorway: ${colorway}.`,
      "LOKIN Brand DNA: vault-black foundation, precise neon-lime energy, restrained AI-cyan intelligence accents, metal-silver hardware, premium functional construction, cinematic but commercially credible.",
      "Presentation quality: elite industrial-design board, realistic materials, crisp silhouettes, controlled studio lighting, black seamless background, no watermark, no third-party logos, no copyrighted characters, no celebrity likenesses.",
      "Show only a concept visualization. Do not include claims that it is available, manufactured, tested, certified, or approved.",
    ].join("\n");

    const generated = await base44.integrations.Core.GenerateImage({ prompt });
    const fileUrl = generated?.url;
    if (!fileUrl) return Response.json({ error: "Image provider returned no asset" }, { status: 502 });

    const previous = await base44.asServiceRole.entities.OasisDesignAsset.filter(
      { project_id: project.id, asset_type: study.assetType },
      "-version",
      50,
      0,
    );
    const version = Math.max(0, ...(previous || []).map((asset) => Number(asset.version || 0))) + 1;
    const now = new Date().toISOString();

    const asset = await base44.asServiceRole.entities.OasisDesignAsset.create({
      organization_id: project.organization_id || user.organization_id || user.id,
      project_id: project.id,
      asset_type: study.assetType,
      name: `${study.name} v${version}`,
      version,
      file_url: fileUrl,
      generation_prompt: prompt.slice(0, 8000),
      colorway,
      provider: "base44-core-image",
      status: "review",
      rights_status: "unreviewed",
      production_ready: false,
      created_at: now,
    });

    const nextProjectStatus = ["idea", "concept"].includes(project.status) ? "design" : project.status;
    const updatedProject = await base44.asServiceRole.entities.OasisProject.update(project.id, {
      status: nextProjectStatus,
      approval_state: "needs_review",
      next_action: "Review generated concept; approve, reject, or create another version",
      updated_at: now,
    });

    return Response.json({
      success: true,
      asset,
      project: updatedProject,
      credit_class: "image_generation",
      disclosure: "Concept mockup only. Not a manufactured sample or production-ready file.",
    });
  } catch (error) {
    console.error("oasis-design-studio", error);
    return Response.json({ error: error?.message || "OASIS Design Studio unavailable" }, { status: 500 });
  }
});
