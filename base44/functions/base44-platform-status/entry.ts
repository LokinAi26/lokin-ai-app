import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const APP_ID = '6a7a1c830b6bae64604c3139';
const now = () => new Date().toISOString();
const text = (v:any, max=4000) => String(v ?? '').trim().slice(0, max);
const pct = (v:any) => Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Number(v))) : 0;

function summarize(tasks:any[]) {
  const counts:any = { queued:0, running:0, blocked:0, completed:0, failed:0, canceled:0 };
  for (const row of tasks || []) {
    const s = text(row?.status, 40).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, s)) counts[s] += 1;
  }
  const included = (tasks || []).filter((x:any) => text(x?.status, 40).toLowerCase() !== 'canceled');
  const remaining = counts.queued + counts.running + counts.blocked + counts.failed;
  const progress = included.length
    ? Math.round((included.reduce((sum:number, x:any) => sum + pct(x?.progress_percent), 0) / included.length) * 100) / 100
    : 100;
  return {
    tracked: (tasks || []).length,
    remaining,
    progress_percent: progress,
    ...counts,
    coverage: 'connection_tracked_only',
  };
}

async function readMonitoring(appId:string) {
  const apiKey = text(secrets.get('BASE44_MONITORING_API_KEY'), 8000);
  const workspaceId = text(secrets.get('BASE44_WORKSPACE_ID'), 256);
  if (!apiKey || !workspaceId) {
    return {
      configured: false,
      available: false,
      reason: 'BASE44_MONITORING_API_KEY_AND_BASE44_WORKSPACE_ID_REQUIRED',
      capability: 'documented_workspace_usage_health_analytics',
      exposes_builder_queue: false,
    };
  }

  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - 30 * 86400000);
  const ymd = (d:Date) => d.toISOString().slice(0, 10);
  const url = `https://app.base44.com/api/v1/monitoring/${encodeURIComponent(workspaceId)}/apps/${encodeURIComponent(appId)}/analytics?from=${ymd(fromDate)}&to=${ymd(toDate)}`;
  try {
    const res = await fetch(url, { headers: { api_key: apiKey, accept: 'application/json' } });
    if (!res.ok) {
      return {
        configured: true,
        available: false,
        http_status: res.status,
        reason: 'MONITORING_API_REQUEST_FAILED',
        exposes_builder_queue: false,
      };
    }
    const data:any = await res.json().catch(() => ({}));
    return {
      configured: true,
      available: true,
      exposes_builder_queue: false,
      app_analytics: {
        app_id: data.app_id,
        app_name: data.app_name,
        last_published: data.last_published ?? null,
        visibility: data.visibility ?? null,
        views_last_7d: data.views_last_7d ?? null,
        views_last_30d: data.views_last_30d ?? null,
        active_users_last_7d: data.active_users_last_7d ?? null,
        active_users_last_30d: data.active_users_last_30d ?? null,
        message_credits_consumed: data.message_credits_consumed ?? null,
        integration_credits_consumed: data.integration_credits_consumed ?? null,
        has_agent: data.has_agent ?? null,
        has_backend_function: data.has_backend_function ?? null,
        has_authentication: data.has_authentication ?? null,
      },
    };
  } catch (error:any) {
    return {
      configured: true,
      available: false,
      reason: 'MONITORING_API_UNREACHABLE',
      error: text(error?.message || error, 500),
      exposes_builder_queue: false,
    };
  }
}

export default async function(req:Request) {
  try {
    if (req.method !== 'POST') return Response.json({ error:'Method not allowed' }, { status:405 });
    const base44:any = createClientFromRequest(req);
    const user:any = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error:'Unauthorized' }, { status:401 });

    const query:any = user.role === 'admin' ? {} : { owner_user_id:user.id };
    const [tasks, publicSettings, monitoring] = await Promise.all([
      base44.asServiceRole.entities.Base44BuildTask.filter(query, '-updated_date', 500).catch(() => []),
      base44.app.getPublicSettings().catch(() => null),
      readMonitoring(APP_ID),
    ]);

    const trackedQueue = summarize(tasks || []);
    const platformVisibility = {
      platform_internal_builder_queue_visible: false,
      exact_platform_remaining_task_count: null,
      exact_platform_completion_percent: null,
      reason: 'NOT_EXPOSED_BY_DOCUMENTED_BASE44_API_OR_APP_SDK',
      documented_monitoring_api_exposes_builder_queue: false,
      internal_type_metadata_detected: [
        'app_stage',
        'status.state',
        'status.details',
        'status.last_updated_date',
        'needs_to_add_diff',
        'last_deployed_at',
        'app_code_hash',
      ],
      internal_type_metadata_public_method_available: false,
    };
    const devBuild = {
      endpoint: '/__build_status',
      enabled_in_editor_sandbox: true,
      scope: 'development_loopback_only',
      reports: 'last_compile_or_hmr_error',
      is_platform_queue: false,
      callable_from_deployed_server_function: false,
    };
    const completion = {
      connected_workflow_percent: trackedQueue.progress_percent,
      connected_remaining_tasks: trackedQueue.remaining,
      exact_base44_platform_percent: null,
      exact_base44_platform_remaining_tasks: null,
      overall_completion_claim_supported: false,
    };
    const observedAt = now();
    const snapshot:any = {
      app_id:APP_ID,
      observed_at:observedAt,
      tracked_queue:trackedQueue,
      platform_visibility:platformVisibility,
      public_settings:publicSettings || {},
      monitoring_api:monitoring,
      dev_build:devBuild,
      completion,
      notes:{
        no_credential_values_returned:true,
        private_platform_endpoints_not_scraped:true,
        unsupported_status_not_inferred:true,
      },
    };
    await base44.asServiceRole.entities.Base44PlatformStatusSnapshot.create(snapshot).catch(() => null);
    return Response.json({ ok:true, ...snapshot });
  } catch (error:any) {
    console.error('base44-platform-status', error);
    return Response.json({ ok:false, error:text(error?.message || error, 1000) || 'Platform status unavailable' }, { status:500 });
  }
}
