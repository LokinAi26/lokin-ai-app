import { createClientFromRequest } from "npm:@base44/sdk";

const RECIPES = {
  vector_brand_asset: {
    name: "Vector Brand Asset",
    domain: "vector",
    capability: "vector",
    providerKey: "recraft",
    providerName: "Recraft Vector API",
    executionMode: "external_api",
    nodes: ["validate_project", "load_brand_dna", "rights_preflight", "credit_guardian", "vector_generate", "vector_qc", "human_approval"],
  },
  apparel_digital_twin: {
    name: "Apparel Digital Twin",
    domain: "apparel",
    capability: "apparel_3d",
    providerKey: "clo_desktop_bridge",
    providerName: "CLO Desktop Bridge",
    executionMode: "desktop_bridge",
    nodes: ["validate_project", "require_approved_design", "compile_tech_pack", "garment_simulation", "material_qc", "sample_approval"],
  },
  commercial_keyframe_pipeline: {
    name: "Commercial Keyframe Pipeline",
    domain: "video",
    capability: "video",
    providerKey: "lokin_productions",
    providerName: "LOKIN Productions Render Pool",
    executionMode: "cloud_worker",
    nodes: ["validate_project", "require_campaign_asset", "rights_preflight", "credit_guardian", "render_dispatch", "assembly", "qc", "human_approval"],
  },
  mastering_package: {
    name: "Mastering Package",
    domain: "mastering",
    capability: "mastering",
    providerKey: "davinci_bridge",
    providerName: "DaVinci Resolve Bridge",
    executionMode: "desktop_bridge",
    nodes: ["validate_project", "require_approved_cut", "rights_preflight", "edit_package", "color_audio_qc", "delivery_approval"],
  },
};

function clean(value, max = 2000) {
  return String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action || "compile", 40);

    if (action === "list_recipes") {
      return Response.json({
        recipes: Object.entries(RECIPES).map(([key, recipe]) => ({
          key,
          name: recipe.name,
          domain: recipe.domain,
          capability: recipe.capability,
          provider_key: recipe.providerKey,
          setup_status: "setup_required",
        })),
        disclosure: "Catalog only. Listing a recipe does not execute a provider or spend credits.",
      });
    }

    const projectId = clean(body.projectId, 120);
    const workflowKey = clean(body.workflowKey, 80);
    const recipe = RECIPES[workflowKey];
    if (!projectId) return Response.json({ error: "Project ID is required" }, { status: 400 });
    if (!recipe) return Response.json({ error: "Unsupported OASIS workflow" }, { status: 400 });

    const project = await base44.asServiceRole.entities.OasisProject.get(projectId);
    if (!project) return Response.json({ error: "OASIS project not found" }, { status: 404 });
    if (project.owner_user_id && project.owner_user_id !== user.id && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = project.organization_id || user.organization_id || user.id;
    const now = new Date().toISOString();
    const workflowVersion = 1;
    const requestKey = clean(body.requestKey || "default", 160);
    const idempotencyKey = await sha256([organizationId, user.id, project.id, workflowKey, workflowVersion, requestKey].join(":"));

    const existingJobs = await base44.asServiceRole.entities.OasisProductionJob.filter(
      { owner_user_id: user.id, idempotency_key: idempotencyKey },
      "-created_at",
      1,
      0,
    );
    if (existingJobs?.[0]) {
      return Response.json({
        success: true,
        idempotent_replay: true,
        job: existingJobs[0],
        disclosure: "No provider call or additional credit reservation occurred.",
      });
    }

    let definitions = await base44.asServiceRole.entities.OasisWorkflowDefinition.filter(
      { workflow_key: workflowKey, version: workflowVersion },
      "-created_at",
      1,
      0,
    );
    let definition = definitions?.[0];
    if (!definition) {
      definition = await base44.asServiceRole.entities.OasisWorkflowDefinition.create({
        organization_id: organizationId,
        name: recipe.name,
        workflow_key: workflowKey,
        version: workflowVersion,
        domain: recipe.domain,
        graph_json: JSON.stringify({ nodes: recipe.nodes, edges: recipe.nodes.slice(1).map((node, index) => [recipe.nodes[index], node]) }),
        input_schema_json: JSON.stringify({ required: ["projectId", "workflowKey"] }),
        output_schema_json: JSON.stringify({ artifact: "OasisDesignAsset or external mastering package" }),
        approval_policy_json: JSON.stringify({ human_approval_required: true, external_commitments_blocked: true }),
        rights_policy_json: JSON.stringify({ preflight_required: true, blocked_assets_cannot_execute: true }),
        active: true,
        created_by_user_id: user.id,
        created_at: now,
      });
    }

    let providers = await base44.asServiceRole.entities.OasisProviderCapability.filter(
      { provider_key: recipe.providerKey, capability: recipe.capability },
      "-updated_at",
      1,
      0,
    );
    let provider = providers?.[0];
    if (!provider) {
      provider = await base44.asServiceRole.entities.OasisProviderCapability.create({
        organization_id: organizationId,
        provider_key: recipe.providerKey,
        display_name: recipe.providerName,
        capability: recipe.capability,
        execution_mode: recipe.executionMode,
        setup_status: "setup_required",
        health_status: "unknown",
        supports_async: true,
        max_concurrency: 0,
        estimated_unit_cost_usd: 0,
        configuration_json: JSON.stringify({ credentials_stored: false, activation_required: true }),
        updated_at: now,
      });
    }

    const status = provider.setup_status === "configured" && provider.health_status === "healthy"
      ? "awaiting_approval"
      : "setup_required";

    const job = await base44.asServiceRole.entities.OasisProductionJob.create({
      organization_id: organizationId,
      owner_user_id: user.id,
      project_id: project.id,
      workflow_definition_id: definition.id,
      workflow_key: workflowKey,
      workflow_version: workflowVersion,
      requested_capability: recipe.capability,
      provider_key: recipe.providerKey,
      status,
      input_json: JSON.stringify({
        project_id: project.id,
        source_asset_id: clean(body.sourceAssetId, 120),
        user_parameters: body.parameters && typeof body.parameters === "object" ? body.parameters : {},
      }).slice(0, 12000),
      output_json: "{}",
      input_asset_hashes_json: "[]",
      estimated_cost_usd: 0,
      reserved_cost_usd: 0,
      actual_cost_usd: 0,
      credit_guardian_decision: status === "setup_required" ? "not_evaluated_provider_setup_required" : "approval_required_before_reservation",
      approval_id: "",
      idempotency_key: idempotencyKey,
      attempt_count: 0,
      error_code: status === "setup_required" ? "PROVIDER_SETUP_REQUIRED" : "",
      error_message: status === "setup_required" ? `${recipe.providerName} is not configured and healthy.` : "",
      created_at: now,
      updated_at: now,
    });

    return Response.json({
      success: true,
      job,
      workflow: { id: definition.id, key: workflowKey, version: workflowVersion, nodes: recipe.nodes },
      provider: {
        key: provider.provider_key,
        setup_status: provider.setup_status,
        health_status: provider.health_status,
      },
      executable: false,
      disclosure: status === "setup_required"
        ? "Workflow compiled safely. Provider setup is required; no generation, credit spend, publishing, manufacturing, or ordering occurred."
        : "Workflow compiled. Human approval and Credit Guardian authorization are required before execution.",
    });
  } catch (error) {
    console.error("oasis-production-fabric", error);
    return Response.json({ error: error?.message || "OASIS Production Fabric unavailable" }, { status: 500 });
  }
});
