import { createClientFromRequest } from "npm:@base44/sdk";

function safe(value: unknown, max = 1000) {
  return String(value || "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);
}

function tokens(value: unknown) {
  const stop = new Set(["lokin", "the", "and", "for", "with", "from", "this", "that", "product", "design"]);
  return new Set(
    safe(value, 3000).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
      .filter((token) => token.length > 2 && !stop.has(token)),
  );
}

function categoryTerms(category: string) {
  const value = category.toLowerCase();
  if (value.includes("apparel")) return "shirt tee tshirt hoodie sweatshirt jacket tank apparel clothing";
  if (value.includes("driver")) return "driver jacket vest shirt hat cap bag mug accessory gear";
  if (value.includes("access")) return "accessory bag hat cap mug case";
  if (value.includes("tech")) return "technology device case accessory";
  return value;
}

function scoreProduct(query: Set<string>, name: unknown) {
  const candidate = tokens(name);
  let overlap = 0;
  query.forEach((token) => { if (candidate.has(token)) overlap += 1; });
  const exact = safe(name).toLowerCase();
  query.forEach((token) => { if (exact.includes(token)) overlap += 0.25; });
  return Number((overlap / Math.max(1, query.size) * 100).toFixed(1));
}

function unwrap(response: any) {
  return response?.data || response || {};
}

async function requireOwnedProject(base44: any, user: any, projectId: string) {
  const project = await base44.asServiceRole.entities.OasisProject.get(projectId);
  if (!project) throw new Response(JSON.stringify({ error: "OASIS project not found" }), { status: 404 });
  if (project.owner_user_id && project.owner_user_id !== user.id && user.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  return project;
}

async function requireOwnedCandidate(base44: any, user: any, candidateId: string) {
  const candidate = await base44.asServiceRole.entities.OasisSupplierCandidate.get(candidateId);
  if (!candidate) throw new Response(JSON.stringify({ error: "Supplier candidate not found" }), { status: 404 });
  const project = await requireOwnedProject(base44, user, candidate.project_id);
  return { candidate, project };
}

async function matchProvider(base44: any, supplier: string) {
  try {
    if (supplier === "Printful") {
      const connection = unwrap(await base44.functions.invoke("printful-catalog", { action: "connection" }));
      if (!connection.connected) {
        return { products: [], note: connection.error || "Connect Printful before live catalog matching." };
      }
      const catalog = unwrap(await base44.functions.invoke("printful-catalog", { action: "catalog", limit: 100 }));
      return { products: Array.isArray(catalog.products) ? catalog.products : [], note: "" };
    }

    const shopResult = unwrap(await base44.functions.invoke("printify-catalog", { action: "shops" }));
    const shop = Array.isArray(shopResult.shops) ? shopResult.shops[0] : null;
    if (!shop?.id) return { products: [], note: "Connect a Printify shop before live catalog matching." };
    const catalog = unwrap(await base44.functions.invoke("printify-catalog", {
      action: "catalog",
      shop_id: shop.id,
      limit: 100,
    }));
    return { products: Array.isArray(catalog.products) ? catalog.products : [], note: "" };
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || `${supplier} catalog is unavailable.`;
    return { products: [], note: safe(message, 500) };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = safe(body.action, 40).toLowerCase();
    const now = new Date().toISOString();

    if (action === "match") {
      const projectId = safe(body.projectId, 120);
      if (!projectId) return Response.json({ error: "Project ID is required" }, { status: 400 });
      const project = await requireOwnedProject(base44, user, projectId);
      const specs = await base44.asServiceRole.entities.OasisProductSpec.filter(
        { project_id: project.id }, "-version", 50, 0,
      );
      const spec = specs?.[0];
      if (!spec) return Response.json({ error: "Create a product specification before matching suppliers" }, { status: 409 });

      const existing = await base44.asServiceRole.entities.OasisSupplierCandidate.filter(
        { project_id: project.id, product_spec_id: spec.id }, "-checked_at", 20, 0,
      );
      const query = tokens([
        project.title,
        project.idea,
        project.category,
        categoryTerms(project.category || ""),
        spec.materials,
        spec.decoration_method,
      ].join(" "));
      const candidates = [];

      for (const supplier of ["Printful", "Printify"]) {
        let candidate = (existing || []).find((item: any) => item.supplier === supplier);
        if (!candidate) {
          candidate = await base44.asServiceRole.entities.OasisSupplierCandidate.create({
            organization_id: project.organization_id || user.organization_id || user.id,
            owner_user_id: user.id,
            project_id: project.id,
            product_spec_id: spec.id,
            supplier,
            match_status: "needs_catalog_match",
            checked_at: now,
          });
        }

        const result = await matchProvider(base44, supplier);
        const ranked = result.products
          .map((product: any) => ({ product, score: scoreProduct(query, product.name || product.title) }))
          .sort((a: any, b: any) => b.score - a.score);
        const best = ranked[0];

        if (!best?.product?.id || best.score <= 0) {
          candidates.push(await base44.asServiceRole.entities.OasisSupplierCandidate.update(candidate.id, {
            supplier_product_id: "",
            product_title: "",
            product_image_url: "",
            match_status: result.note ? "needs_catalog_match" : "unavailable",
            live_match_score: 0,
            cost_verified: false,
            margin_passed: false,
            inventory_verified: false,
            notes: result.note || "The connected live catalog returned no matching products.",
            checked_at: now,
            catalog_checked_at: now,
          }));
          continue;
        }

        const variants = Array.isArray(best.product.variants) ? best.product.variants : [];
        const inventoryVerified = supplier === "Printful"
          ? variants.some((variant: any) => variant.in_stock === true)
          : best.product.visible !== false && variants.some((variant: any) => variant.is_enabled === true);
        candidates.push(await base44.asServiceRole.entities.OasisSupplierCandidate.update(candidate.id, {
          supplier_product_id: String(best.product.id),
          product_title: safe(best.product.name || best.product.title, 300),
          product_image_url: safe(best.product.thumbnail_url || "", 1200),
          match_status: "candidate",
          live_match_score: best.score,
          estimated_base_cost: 0,
          estimated_shipping: 0,
          landed_cost: 0,
          estimated_margin_percent: 0,
          cost_verified: false,
          margin_passed: false,
          inventory_verified: inventoryVerified,
          quality_verified: false,
          notes: "Matched to a real live catalog product. Availability is a catalog signal only. Base cost, shipping, taxes, fees, quality, and physical suitability remain unverified.",
          checked_at: now,
          catalog_checked_at: now,
        }));
      }

      const updatedProject = await base44.asServiceRole.entities.OasisProject.update(project.id, {
        status: "production_review",
        approval_state: "needs_review",
        next_action: "Confirm landed cost for a live supplier match before requesting a sample",
        updated_at: now,
      });
      return Response.json({
        success: true,
        candidates,
        project: updatedProject,
        disclosure: "Read-only catalog matching completed. No supplier product, order, sample, or payment was created.",
      });
    }

    if (action === "verify_cost") {
      const candidateId = safe(body.candidateId, 120);
      const baseCost = Number(body.baseCost);
      const shipping = Number(body.shipping);
      if (!candidateId || !Number.isFinite(baseCost) || baseCost <= 0 || !Number.isFinite(shipping) || shipping < 0) {
        return Response.json({ error: "Candidate, positive base cost, and non-negative shipping are required" }, { status: 400 });
      }
      const { candidate, project } = await requireOwnedCandidate(base44, user, candidateId);
      if (!candidate.supplier_product_id || !["candidate", "verified"].includes(candidate.match_status)) {
        return Response.json({ error: "A live supplier product match is required before cost verification" }, { status: 409 });
      }
      const spec = await base44.asServiceRole.entities.OasisProductSpec.get(candidate.product_spec_id);
      if (!spec) return Response.json({ error: "Product specification not found" }, { status: 404 });
      const retail = Number(spec.target_retail_price || project.recommended_price || project.target_price || 0);
      const landed = Number((baseCost + shipping).toFixed(2));
      const margin = retail > 0 ? Number((((retail - landed) / retail) * 100).toFixed(2)) : 0;
      const targetMargin = Math.max(0, Number(project.target_margin || 0));
      const marginPassed = retail > 0 && margin >= targetMargin;
      const verified = Boolean(candidate.inventory_verified) && marginPassed;

      const updatedCandidate = await base44.asServiceRole.entities.OasisSupplierCandidate.update(candidate.id, {
        estimated_base_cost: Number(baseCost.toFixed(2)),
        estimated_shipping: Number(shipping.toFixed(2)),
        landed_cost: landed,
        estimated_margin_percent: margin,
        cost_verified: true,
        margin_passed: marginPassed,
        match_status: verified ? "verified" : "candidate",
        notes: marginPassed
          ? "Landed cost was manually confirmed by the user and passes the target margin. It was not quoted automatically by the provider. Taxes, transaction fees, quality, and physical suitability remain unverified."
          : `Landed cost was manually confirmed, but the ${margin.toFixed(1)}% margin misses the ${targetMargin.toFixed(1)}% target. Sample advancement is blocked until economics improve.`,
        checked_at: now,
      });
      const updatedProject = await base44.asServiceRole.entities.OasisProject.update(project.id, {
        next_action: verified
          ? "Create a sample approval request"
          : marginPassed
            ? "Recheck live catalog availability before requesting a sample"
            : "Reduce landed cost or revise retail price before requesting a sample",
        updated_at: now,
      });
      return Response.json({ success: true, candidate: updatedCandidate, project: updatedProject });
    }

    if (action === "request_sample") {
      const candidateId = safe(body.candidateId, 120);
      const { candidate, project } = await requireOwnedCandidate(base44, user, candidateId);
      if (
        candidate.match_status !== "verified" ||
        candidate.cost_verified !== true ||
        candidate.margin_passed !== true ||
        candidate.inventory_verified !== true ||
        !candidate.supplier_product_id
      ) {
        return Response.json({ error: "Verified product ID, availability, landed cost, and target-margin pass are required before sample approval" }, { status: 409 });
      }

      const existing = await base44.asServiceRole.entities.OasisSampleRequest.filter(
        { supplier_candidate_id: candidate.id }, "-created_at", 20, 0,
      );
      const active = (existing || []).find((item: any) =>
        ["awaiting_approval", "approved_not_ordered", "ordered", "received"].includes(item.status)
      );
      if (active) return Response.json({ success: true, sample: active, project, existing: true });

      const approval = await base44.asServiceRole.entities.OasisApproval.create({
        organization_id: project.organization_id || user.organization_id || user.id,
        project_id: project.id,
        gate: "sample",
        decision: "pending",
        reviewer_user_id: "",
        note: `Approve one ${candidate.supplier} sample for catalog product ${candidate.supplier_product_id}. Approval does not place an order.`,
      });
      const sample = await base44.asServiceRole.entities.OasisSampleRequest.create({
        organization_id: project.organization_id || user.organization_id || user.id,
        owner_user_id: user.id,
        project_id: project.id,
        product_spec_id: candidate.product_spec_id,
        supplier_candidate_id: candidate.id,
        status: "awaiting_approval",
        quantity: 1,
        estimated_cost: Number(candidate.landed_cost || 0),
        approval_id: approval.id,
        external_order_id: "",
        notes: "Approval request only. No supplier order, payment, address transmission, or manufacturing commitment has occurred.",
        created_at: now,
      });
      const updatedProject = await base44.asServiceRole.entities.OasisProject.update(project.id, {
        status: "sample",
        approval_state: "needs_review",
        next_action: "Review and approve the sample request; supplier ordering remains a separate future action",
        updated_at: now,
      });
      return Response.json({
        success: true,
        sample,
        approval,
        project: updatedProject,
        disclosure: "Sample approval requested. Nothing was ordered and no payment was made.",
      });
    }

    if (action === "approve_sample") {
      const sampleRequestId = safe(body.sampleRequestId, 120);
      const sample = await base44.asServiceRole.entities.OasisSampleRequest.get(sampleRequestId);
      if (!sample) return Response.json({ error: "Sample request not found" }, { status: 404 });
      const project = await requireOwnedProject(base44, user, sample.project_id);
      if (sample.status !== "awaiting_approval") {
        return Response.json({ error: "Only an awaiting-approval sample can be approved" }, { status: 409 });
      }
      const approval = await base44.asServiceRole.entities.OasisApproval.update(sample.approval_id, {
        decision: "approved",
        reviewer_user_id: user.id,
        note: "Sample request approved for planning only. A separate explicit order action is still required.",
        decided_at: now,
      });
      const updatedSample = await base44.asServiceRole.entities.OasisSampleRequest.update(sample.id, {
        status: "approved_not_ordered",
        notes: "Approved, not ordered. No provider order or payment exists.",
      });
      const updatedProject = await base44.asServiceRole.entities.OasisProject.update(project.id, {
        approval_state: "approved",
        next_action: "Select a future explicit supplier-order action when shipping and payment details are ready",
        updated_at: now,
      });
      return Response.json({
        success: true,
        sample: updatedSample,
        approval,
        project: updatedProject,
        disclosure: "Approved—not ordered. No supplier API order call was made.",
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) {
      return new Response(error.body, { status: error.status, headers: { "Content-Type": "application/json" } });
    }
    console.error("oasis-supplier-control", error);
    return Response.json({ error: error?.message || "OASIS supplier control unavailable" }, { status: 500 });
  }
});