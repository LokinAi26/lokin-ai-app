import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from "npm:@base44/sdk";
import { CONTROL_PLANE_VERSION, exportControlEnvelope } from "../../shared/unifiedControlPlane.js";

const clean = (value:any, max=4000) => String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

async function bridge(action:string, payload:any={}) {
  const url = clean(Deno.env.get("LOKIN_PRODUCTIONS_BRIDGE_URL"), 2000).replace(/\/$/, "");
  const token = clean(Deno.env.get("LOKIN_PRODUCTIONS_BRIDGE_TOKEN"), 2000);
  if (!url || !token) {
    return { ok:false, status:503, data:{ error:"LOKIN_PRODUCTIONS_BRIDGE_SETUP_REQUIRED" } };
  }
  const response = await fetch(url, {
    method: action === "health" ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(action === "health" ? {} : { "content-type":"application/json" }),
    },
    ...(action === "health" ? {} : { body:JSON.stringify({ action, ...payload }) }),
    redirect:"manual",
  });
  return { ok:response.ok, status:response.status, data:await response.json().catch(()=>({})) };
}

export default async function(req:Request) {
  const base44 = createClientFromRequest(req);
  try {
    if (req.method !== "POST") return Response.json({ error:"Method not allowed" }, { status:405 });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error:"Unauthorized" }, { status:401 });
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'oasis_render_pool_bridge', priority:65, estimatedMs:5000, realtime:false, background:false, tags:['provider'] });
    const body = await req.json().catch(()=>({}));
    const action = clean(body.action || "health", 40);

    if (action === "health") {
      const result = await bridge("health");
      return Response.json({
        configured: result.status !== 503,
        healthy: result.ok && result.data?.status === "healthy",
        status: result.ok ? result.data?.status : "setup_required",
        render_pool: result.data,
        control_plane_version:CONTROL_PLANE_VERSION,
        zero_spend_probe: true,
      }, { status: result.ok ? 200 : result.status });
    }

    if (action === "control_health") {
      const result = await bridge("control_health", { namespace:clean(body.namespace || "lokin.production",100) });
      return Response.json({ configured:result.status !== 503, healthy:result.ok && result.data?.control_plane?.status !== "action_required", control_plane_version:CONTROL_PLANE_VERSION, remote:result.data }, { status:result.ok ? 200 : result.status });
    }

    if (action === "control_resolve") {
      if (!body.canonical_key) return Response.json({ error:"canonical_key is required" }, { status:400 });
      const result = await bridge("control_resolve", { canonical_key:clean(body.canonical_key,320), namespace:clean(body.namespace || "lokin",100), scope_chain:Array.isArray(body.scope_chain) ? body.scope_chain : [] });
      return Response.json({ control_plane_version:CONTROL_PLANE_VERSION, remote:result.data }, { status:result.status });
    }

    if (action === "control_sync") {
      const stateId = clean(body.state_id,180);
      if (!stateId) return Response.json({ error:"state_id is required" }, { status:400 });
      const state = await base44.asServiceRole.entities.LokinControlState.get(stateId).catch(() => null);
      if (!state) return Response.json({ error:"CONTROL_STATE_NOT_FOUND" }, { status:404 });
      if (state.owner_user_id && state.owner_user_id !== user.id && user.role !== "admin") return Response.json({ error:"Forbidden" }, { status:403 });
      const envelope = exportControlEnvelope(state);
      const result = await bridge("control_sync", { envelope });
      return Response.json({ synced:result.ok, control_plane_version:CONTROL_PLANE_VERSION, local_state_id:state.id, remote:result.data }, { status:result.status });
    }

    if (action !== "plan") return Response.json({ error:"Unsupported action" }, { status:400 });
    const jobId = clean(body.jobId, 160);
    if (!jobId) return Response.json({ error:"jobId is required" }, { status:400 });

    const job = await base44.asServiceRole.entities.OasisProductionJob.get(jobId);
    if (!job) return Response.json({ error:"OASIS production job not found" }, { status:404 });
    if (job.owner_user_id !== user.id && user.role !== "admin") return Response.json({ error:"Forbidden" }, { status:403 });
    if (job.workflow_key !== "commercial_keyframe_pipeline" || job.provider_key !== "lokin_productions") {
      return Response.json({ error:"Job is not a LOKIN Productions video workflow" }, { status:409 });
    }
    if (job.output_json && ["awaiting_approval","completed"].includes(job.status)) {
      return Response.json({ success:true, idempotent_replay:true, job, output:JSON.parse(job.output_json || "{}"), executable:false });
    }
    if (!["queued","awaiting_approval"].includes(job.status)) {
      return Response.json({
        error:"RENDER_POOL_PLAN_NOT_AUTHORIZED",
        reason:"Provider must be healthy and the workflow must pass its human approval gate before planning.",
        executable:false,
      }, { status:409 });
    }

    const campaignApprovals = await base44.asServiceRole.entities.OasisApproval.filter(
      { project_id:job.project_id, gate:"campaign", decision:"approved" },
      "-decided_at",
      1,
      0,
    );
    if (!campaignApprovals?.[0]) {
      return Response.json({ error:"CAMPAIGN_APPROVAL_REQUIRED", executable:false }, { status:409 });
    }

    const project = await base44.asServiceRole.entities.OasisProject.get(job.project_id);
    if (!project) return Response.json({ error:"OASIS project not found" }, { status:404 });

    const input = JSON.parse(job.input_json || "{}");
    const result = await bridge("plan", {
      external_job_id:job.id,
      external_project_id:project.id,
      workflow_key:job.workflow_key,
      idempotency_key:job.idempotency_key,
      title:`${clean(project.title, 120)} — OASIS Commercial`,
      brief:clean(project.production_plan || project.director_summary || project.idea, 5000),
      aspect_ratio:clean(input?.user_parameters?.aspect_ratio || "16:9", 20),
      target_duration_seconds:Math.min(120, Math.max(4, Number(input?.user_parameters?.duration_seconds) || 8)),
      delivery_resolution:clean(input?.user_parameters?.delivery_resolution || "1080p", 40),
      visual_style:clean(project.design_direction || "cinematic LOKIN brand system", 1000),
      source_asset_url:clean(input?.user_parameters?.source_asset_url, 2000),
      source_asset_hash:clean(input?.user_parameters?.source_asset_hash, 256),
    });
    if (!result.ok) {
      const setup = result.status === 401 || result.status === 403 || result.status === 503;
      await base44.asServiceRole.entities.OasisProductionJob.update(job.id, {
        status:setup ? "setup_required" : "blocked",
        error_code:setup ? "LOKIN_PRODUCTIONS_BRIDGE_SETUP_REQUIRED" : "LOKIN_PRODUCTIONS_BRIDGE_FAILED",
        error_message:clean(result.data?.error || `Bridge returned HTTP ${result.status}`, 1000),
        updated_at:new Date().toISOString(),
      });
      return Response.json({ error:result.data?.error || "LOKIN Productions bridge failed", executable:false }, { status:result.status });
    }

    const output = {
      bridge_request_id:result.data?.request?.id || "",
      productions_workflow_id:result.data?.workflow_id || "",
      execution_authorized:false,
      credits_reserved:false,
    };
    const updated = await base44.asServiceRole.entities.OasisProductionJob.update(job.id, {
      status:"awaiting_approval",
      output_json:JSON.stringify(output),
      actual_cost_usd:0,
      error_code:"",
      error_message:"",
      updated_at:new Date().toISOString(),
    });
    return Response.json({
      success:true,
      job:updated,
      output,
      executable:false,
      disclosure:"LOKIN Productions draft plan created. No shots rendered, provider called, or credits reserved.",
    });
  } catch(error:any) {
    console.error("oasis-render-pool-adapter", error);
    return Response.json({ error:clean(error?.message || error, 1000) || "Render pool adapter unavailable" }, { status:500 });
  }
}
