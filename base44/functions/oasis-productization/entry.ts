import { createClientFromRequest } from "npm:@base44/sdk";

const CATEGORY_DEFAULTS = {
  Apparel: {
    materials: "Draft assumption: premium cotton/poly blend or performance textile; exact fiber content, weight, origin, and certifications require supplier verification.",
    dimensions: "Use the selected supplier's verified size chart and print-area template; no dimensions are production-authoritative yet.",
    decoration: "Draft candidates: DTG, DTF, embroidery, or screen print based on artwork complexity and order volume.",
    packaging: "Protective recyclable mailer, branded insert, care instructions, SKU/size label, and scan-ready fulfillment barcode.",
  },
  "Driver gear": {
    materials: "Draft assumption: abrasion-resistant exterior, high-visibility accents, weather-resistant components, and driver-safe hardware; all claims require testing.",
    dimensions: "Dimensions must be derived from the verified supplier sample and intended in-vehicle use case.",
    decoration: "Durable embroidery, woven patch, molded mark, or reflective transfer subject to material testing.",
    packaging: "Protective retail carton or mailer with usage instructions, warnings, SKU, and traceable batch label.",
  },
  Accessory: {
    materials: "Draft assumption only; select materials after durability, skin-contact, temperature, and intended-use review.",
    dimensions: "Final dimensions require supplier CAD, dieline, or measured physical sample.",
    decoration: "Laser mark, pad print, woven label, embroidery, or durable transfer after adhesion testing.",
    packaging: "Right-sized recyclable package with product insert, warnings, SKU, and barcode.",
  },
  Technology: {
    materials: "Draft enclosure and component assumptions only; electrical, battery, radio, and safety compliance require qualified engineering and testing.",
    dimensions: "Final dimensions require verified CAD, component stack, thermal envelope, and manufacturing tolerances.",
    decoration: "Molded, laser-etched, or pad-printed brand treatment after material and regulatory review.",
    packaging: "Protective packaging with serial traceability, instructions, warranty terms, and required compliance marks only after certification.",
  },
};

function safe(value, max = 1000) {
  return String(value || "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);
}

function skuBase(title) {
  const clean = safe(title, 80).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `LOK-${clean || "PRODUCT"}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const projectId = safe(body.projectId, 120);
    if (!projectId) return Response.json({ error: "Project ID is required" }, { status: 400 });

    const project = await base44.asServiceRole.entities.OasisProject.get(projectId);
    if (!project) return Response.json({ error: "OASIS project not found" }, { status: 404 });
    if (project.owner_user_id && project.owner_user_id !== user.id && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const approvedAssets = await base44.asServiceRole.entities.OasisDesignAsset.filter(
      { project_id: project.id, status: "approved" },
      "-created_at",
      50,
      0,
    );
    const approvedAsset = approvedAssets?.[0];
    if (!approvedAsset) {
      return Response.json({ error: "Approve at least one OASIS design asset before productization" }, { status: 409 });
    }

    const previousSpecs = await base44.asServiceRole.entities.OasisProductSpec.filter(
      { project_id: project.id },
      "-version",
      50,
      0,
    );
    const version = Math.max(0, ...(previousSpecs || []).map((spec) => Number(spec.version || 0))) + 1;
    const defaults = CATEGORY_DEFAULTS[project.category] || CATEGORY_DEFAULTS.Accessory;
    const targetPrice = Math.max(0, Number(project.recommended_price || project.target_price || 0));
    const estimatedCost = Math.max(
      0,
      Number(project.estimated_unit_cost || (targetPrice * (1 - Number(project.target_margin || 0) / 100)) || 0),
    );
    const contribution = Number((targetPrice - estimatedCost).toFixed(2));
    const margin = targetPrice > 0 ? Number(((contribution / targetPrice) * 100).toFixed(2)) : 0;
    const now = new Date().toISOString();
    const sku = `${skuBase(project.title)}-V${version}`;

    const spec = await base44.asServiceRole.entities.OasisProductSpec.create({
      organization_id: project.organization_id || user.organization_id || user.id,
      owner_user_id: user.id,
      project_id: project.id,
      design_asset_id: approvedAsset.id,
      sku,
      version,
      category: project.category || "Other",
      materials: defaults.materials,
      dimensions: defaults.dimensions,
      decoration_method: defaults.decoration,
      colorway: approvedAsset.colorway || "Approved design colorway",
      packaging: defaults.packaging,
      quality_checks: "Physical sample inspection; artwork placement; color tolerance; material verification; construction integrity; packaging fit; barcode scan; wash/wear or intended-use test as applicable.",
      target_retail_price: targetPrice,
      estimated_unit_cost: estimatedCost,
      estimated_contribution_profit: contribution,
      estimated_margin_percent: margin,
      readiness_score: 55,
      status: "review",
      assumptions: "This is a controlled draft derived from an approved concept. Supplier catalog IDs, inventory, shipping, taxes, fees, rights clearance, exact materials, dimensions, certifications, and physical quality remain unverified.",
      created_at: now,
    });

    const candidates = [];
    for (const supplier of ["Printful", "Printify"]) {
      candidates.push(await base44.asServiceRole.entities.OasisSupplierCandidate.create({
        organization_id: project.organization_id || user.organization_id || user.id,
        owner_user_id: user.id,
        project_id: project.id,
        product_spec_id: spec.id,
        supplier,
        supplier_product_id: "",
        match_status: "needs_catalog_match",
        estimated_base_cost: 0,
        estimated_shipping: 0,
        landed_cost: 0,
        estimated_margin_percent: 0,
        cost_verified: false,
        margin_passed: false,
        inventory_verified: false,
        quality_verified: false,
        notes: "Candidate only. Live catalog match, availability, shipping, and landed cost must be fetched and verified before approval.",
        checked_at: now,
      }));
    }

    const updatedProject = await base44.asServiceRole.entities.OasisProject.update(project.id, {
      status: "production_review",
      approval_state: "needs_review",
      next_action: "Verify live Printful/Printify catalog matches and landed costs before requesting a sample",
      updated_at: now,
    });

    return Response.json({
      success: true,
      spec,
      candidates,
      project: updatedProject,
      disclosure: "Draft specification only. No supplier order, catalog listing, or manufacturing commitment was created.",
    });
  } catch (error) {
    console.error("oasis-productization", error);
    return Response.json({ error: error?.message || "OASIS Productization unavailable" }, { status: 500 });
  }
});
