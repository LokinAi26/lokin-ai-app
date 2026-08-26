import { createClientFromRequest } from "npm:@base44/sdk";

const clean = (value:any, max=4000) => String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

async function sha256(value:string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default async function(req:Request) {
  const base44 = createClientFromRequest(req);
  let job:any = null;
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const jobId = clean(body.jobId, 160);
    if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

    job = await base44.asServiceRole.entities.OasisProductionJob.get(jobId);
    if (!job) return Response.json({ error: "OASIS production job not found" }, { status: 404 });
    if (job.owner_user_id !== user.id && user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    if (job.workflow_key !== "vector_brand_asset" || job.provider_key !== "recraft") {
      return Response.json({ error: "Job is not a Recraft vector workflow" }, { status: 409 });
    }
    if (job.status === "completed" && job.output_json) {
      return Response.json({ success: true, idempotent_replay: true, job, output: JSON.parse(job.output_json || "{}") });
    }
    if (job.status !== "queued" || job.credit_guardian_decision !== "approved") {
      return Response.json({
        error: "VECTOR_EXECUTION_NOT_AUTHORIZED",
        reason: "Job must be queued with an approved Credit Guardian decision.",
        executable: false,
      }, { status: 409 });
    }

    const approvals = await base44.asServiceRole.entities.OasisApproval.filter(
      { project_id: job.project_id, decision: "approved" },
      "-decided_at",
      100,
      0,
    );
    const rightsApproval = approvals.find((row:any) => row.gate === "rights");
    const spendApproval = approvals.find((row:any) => row.gate === "spend");
    if (!rightsApproval || !spendApproval) {
      return Response.json({
        error: "APPROVAL_GATES_INCOMPLETE",
        required: ["rights", "spend"],
        executable: false,
      }, { status: 409 });
    }

    const token = clean(Deno.env.get("RECRAFT_API_TOKEN") || Deno.env.get("RECRAFT_API_KEY"), 2000);
    if (!token) {
      await base44.asServiceRole.entities.OasisProductionJob.update(job.id, {
        status: "setup_required",
        error_code: "RECRAFT_SETUP_REQUIRED",
        error_message: "RECRAFT_API_TOKEN is not configured.",
        updated_at: new Date().toISOString(),
      });
      return Response.json({ error: "RECRAFT_SETUP_REQUIRED", executable: false }, { status: 503 });
    }

    const project = await base44.asServiceRole.entities.OasisProject.get(job.project_id);
    if (!project) return Response.json({ error: "OASIS project not found" }, { status: 404 });

    const prompt = clean(body.prompt || [
      "Create an original, editable vector brand asset for LOKIN OASIS.",
      `Project: ${project.title}.`,
      `Idea: ${project.idea}.`,
      `Design direction: ${project.design_direction || "premium functional design"}.`,
      "Brand system: vault black, neon lime #AAFF00, restrained AI cyan #06D9F9, clean geometry, commercially usable silhouette.",
      "No third-party logos, copyrighted characters, celebrity likenesses, watermarks, or unsupported product claims.",
      "Output must be suitable for human design review; it is not automatically a production or manufacturing file.",
    ].join("\n"), 8000);
    const promptHash = await sha256(prompt);
    const now = new Date().toISOString();

    await base44.asServiceRole.entities.OasisProductionJob.update(job.id, {
      status: "running",
      attempt_count: Number(job.attempt_count || 0) + 1,
      started_at: now,
      error_code: "",
      error_message: "",
      updated_at: now,
    });

    const response = await fetch("https://external.api.recraft.ai/v1/images/generations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model: "recraftv4_vector",
        n: 1,
        size: clean(body.size || "1:1", 40),
        response_format: "url",
        controls: {
          colors: [
            { rgb: [170, 255, 0] },
            { rgb: [6, 217, 249] },
            { rgb: [8, 10, 12] },
          ],
        },
      }),
      redirect: "error",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(clean(payload?.error?.message || payload?.error || `Recraft returned HTTP ${response.status}`, 1000));

    const fileUrl = clean(payload?.data?.[0]?.url, 3000);
    if (!fileUrl) throw new Error("Recraft returned no vector asset URL.");

    const previous = await base44.asServiceRole.entities.OasisDesignAsset.filter(
      { project_id: project.id, asset_type: "graphic" },
      "-version",
      100,
      0,
    );
    const version = Math.max(0, ...(previous || []).map((asset:any) => Number(asset.version || 0))) + 1;
    const asset = await base44.asServiceRole.entities.OasisDesignAsset.create({
      organization_id: project.organization_id || user.organization_id || user.id,
      owner_user_id: user.id,
      project_id: project.id,
      asset_type: "graphic",
      name: `Recraft vector brand asset v${version}`,
      version,
      file_url: fileUrl,
      generation_prompt: prompt,
      colorway: "Vault Black / LOKIN Neon Lime / AI Cyan",
      provider: "recraftv4_vector",
      review_note: "Generated vector requires human brand, rights, print, and production review.",
      status: "review",
      rights_status: "clear",
      production_ready: false,
      created_at: now,
    });
    const outputHash = await sha256(fileUrl);

    const lineage = await base44.asServiceRole.entities.OasisAssetLineage.create({
      organization_id: project.organization_id || user.organization_id || user.id,
      owner_user_id: user.id,
      project_id: project.id,
      job_id: job.id,
      parent_asset_id: clean(body.sourceAssetId, 160),
      output_asset_id: asset.id,
      relationship: "vectorized_from",
      provider_key: "recraft",
      model_key: "recraftv4_vector",
      workflow_key: job.workflow_key,
      workflow_version: Number(job.workflow_version || 1),
      seed: "",
      prompt_hash: promptHash,
      input_hash: clean(body.sourceAssetHash, 256),
      output_hash: outputHash,
      rights_status: "clear",
      approval_id: rightsApproval.id,
      metadata_json: JSON.stringify({ response_format: "url", cost_reported: false }),
      created_at: now,
    });

    const output = { asset_id: asset.id, lineage_id: lineage.id, file_url: fileUrl, provider: "recraft", model: "recraftv4_vector" };
    const completed = await base44.asServiceRole.entities.OasisProductionJob.update(job.id, {
      status: "completed",
      output_json: JSON.stringify(output),
      actual_cost_usd: 0,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      job: completed,
      asset,
      lineage,
      disclosure: "Vector generated after rights, spend, and Credit Guardian approval. Output remains review-stage and not production-ready.",
    });
  } catch (error:any) {
    const message = clean(error?.message || error, 1000) || "Recraft vector generation failed";
    if (job?.id) {
      await base44.asServiceRole.entities.OasisProductionJob.update(job.id, {
        status: "failed",
        error_code: "RECRAFT_VECTOR_FAILED",
        error_message: message,
        updated_at: new Date().toISOString(),
      }).catch(() => {});
    }
    console.error("oasis-recraft-vector", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
