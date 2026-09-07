import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const now = () => new Date().toISOString();
const text = (v:any, max=4000) => String(v ?? '').trim().slice(0, max);
const integer = (v:any, fallback=0) => Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : fallback;
const percent = (v:any, fallback=0) => Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Number(v))) : fallback;
const ACTIVE = new Set(['queued','running','blocked']);
const TERMINAL = new Set(['completed','failed','canceled']);
const VALID_STATUS = new Set([...ACTIVE, ...TERMINAL]);
const VALID_SOURCE = new Set(['CHATGPT','BASE44_EDITOR','CLAUDE_CODE','REMOTE_AGENT','SYSTEM']);

function canAccess(row:any, user:any) {
  return user?.role === 'admin' || !row?.owner_user_id || row.owner_user_id === user?.id;
}

function summarize(tasks:any[]) {
  const counts = { queued:0, running:0, blocked:0, completed:0, failed:0, canceled:0 };
  for (const task of tasks) {
    const s = String(task.status || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, s)) counts[s] += 1;
  }
  const tracked = tasks.filter((t:any) => t.status !== 'canceled');
  const total = tracked.length;
  const remaining = counts.queued + counts.running + counts.blocked + counts.failed;
  const successful = counts.completed;
  const progressSum = tracked.reduce((sum:number, t:any) => sum + percent(t.progress_percent), 0);
  const progressPercent = total ? Math.round((progressSum / total) * 100) / 100 : 100;
  const completionPercent = total ? Math.round((successful / total) * 10000) / 100 : 100;
  const active = tasks.filter((t:any) => ACTIVE.has(String(t.status || '').toLowerCase()));
  const etaRows = active.filter((t:any) => Number.isFinite(Number(t.estimated_seconds_remaining)));
  const etaCoveragePercent = active.length ? Math.round((etaRows.length / active.length) * 10000) / 100 : 100;
  const estimatedWorkSecondsRemaining = etaRows.reduce((sum:number, t:any) => sum + integer(t.estimated_seconds_remaining), 0);
  return {
    tracked_task_count: tasks.length,
    total_task_count: total,
    remaining_task_count: remaining,
    queue_depth: counts.queued,
    running_count: counts.running,
    blocked_count: counts.blocked,
    failed_count: counts.failed,
    completed_count: counts.completed,
    canceled_count: counts.canceled,
    counts,
    progress_percent: progressPercent,
    completion_percent: completionPercent,
    estimated_work_seconds_remaining: etaRows.length ? estimatedWorkSecondsRemaining : null,
    eta_coverage_percent: etaCoveragePercent,
    eta_is_wall_clock: false,
    coverage_mode: 'connection_tracked',
    platform_internal_queue_visible: false,
  };
}

async function visibleTasks(base44:any, user:any, body:any) {
  const query:any = {};
  if (text(body.batch_id, 180)) query.batch_id = text(body.batch_id, 180);
  if (text(body.source, 40)) query.source = text(body.source, 40).toUpperCase();
  if (text(body.status, 40)) query.status = text(body.status, 40).toLowerCase();
  if (user.role !== 'admin') query.owner_user_id = user.id;
  const rows = await base44.asServiceRole.entities.Base44BuildTask.filter(query, '-updated_date', 500).catch(() => []);
  return (rows || []).filter((row:any) => canAccess(row, user));
}

export default async function(req:Request) {
  try {
    if (req.method !== 'POST') return Response.json({ error:'Method not allowed' }, { status:405 });
    const base44:any = createClientFromRequest(req);
    const user:any = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error:'Unauthorized' }, { status:401 });
    const body:any = await req.json().catch(() => ({}));
    const action = text(body.action || 'status', 40).toLowerCase();

    if (action === 'status' || action === 'list') {
      const tasks = await visibleTasks(base44, user, body);
      const summary = summarize(tasks);
      return Response.json({ ok:true, summary, tasks: action === 'list' ? tasks : undefined, generated_at:now() });
    }

    if (action === 'register') {
      const taskKey = text(body.task_key, 180);
      const title = text(body.title, 500);
      if (!taskKey || !title) return Response.json({ error:'task_key and title are required' }, { status:400 });
      const ownerUserId = user.role === 'admin' && text(body.owner_user_id, 180) ? text(body.owner_user_id, 180) : user.id;
      const prior = await base44.asServiceRole.entities.Base44BuildTask.filter({ task_key:taskKey, owner_user_id:ownerUserId }, '-updated_date', 1).catch(() => []);
      if (prior?.[0]) return Response.json({ ok:true, created:false, task:prior[0], summary:summarize(await visibleTasks(base44, user, body)) });
      const source = VALID_SOURCE.has(text(body.source, 40).toUpperCase()) ? text(body.source, 40).toUpperCase() : 'CHATGPT';
      const record = await base44.asServiceRole.entities.Base44BuildTask.create({
        owner_user_id:ownerUserId,
        task_key:taskKey,
        batch_id:text(body.batch_id, 180),
        source,
        title,
        description:text(body.description, 4000),
        status:'queued',
        progress_percent:0,
        work_units_total:integer(body.work_units_total),
        work_units_completed:0,
        estimated_seconds_remaining:integer(body.estimated_seconds_remaining),
        eta_basis:Number.isFinite(Number(body.estimated_seconds_remaining)) ? 'explicit' : 'unavailable',
        source_reference:text(body.source_reference, 500),
        details:body.details && typeof body.details === 'object' ? body.details : {},
        submitted_at:now(),
        heartbeat_at:now(),
      });
      return Response.json({ ok:true, created:true, task:record, summary:summarize(await visibleTasks(base44, user, body)) });
    }

    if (['update','start','complete','block','fail','cancel'].includes(action)) {
      const taskKey = text(body.task_key, 180);
      const taskId = text(body.task_id, 180);
      let row:any = null;
      if (taskId) row = await base44.asServiceRole.entities.Base44BuildTask.get(taskId).catch(() => null);
      if (!row && taskKey) {
        const query:any = { task_key:taskKey };
        if (user.role !== 'admin') query.owner_user_id = user.id;
        const rows = await base44.asServiceRole.entities.Base44BuildTask.filter(query, '-updated_date', 1).catch(() => []);
        row = rows?.[0] || null;
      }
      if (!row) return Response.json({ error:'Task not found' }, { status:404 });
      if (!canAccess(row, user)) return Response.json({ error:'Forbidden' }, { status:403 });
      const forcedStatus:any = { start:'running', complete:'completed', block:'blocked', fail:'failed', cancel:'canceled' }[action];
      const nextStatus = forcedStatus || text(body.status || row.status, 40).toLowerCase();
      if (!VALID_STATUS.has(nextStatus)) return Response.json({ error:'Invalid status' }, { status:400 });
      const patch:any = {
        status:nextStatus,
        heartbeat_at:now(),
      };
      if (body.title !== undefined) patch.title = text(body.title, 500);
      if (body.description !== undefined) patch.description = text(body.description, 4000);
      if (body.progress_percent !== undefined) patch.progress_percent = percent(body.progress_percent, row.progress_percent || 0);
      if (body.work_units_total !== undefined) patch.work_units_total = integer(body.work_units_total);
      if (body.work_units_completed !== undefined) patch.work_units_completed = integer(body.work_units_completed);
      if (body.estimated_seconds_remaining !== undefined) {
        patch.estimated_seconds_remaining = integer(body.estimated_seconds_remaining);
        patch.eta_basis = text(body.eta_basis, 40) || 'explicit';
      }
      if (body.last_error !== undefined) patch.last_error = text(body.last_error, 2000);
      if (body.details && typeof body.details === 'object') patch.details = { ...(row.details || {}), ...body.details };
      if (nextStatus === 'running' && !row.started_at) patch.started_at = now();
      if (nextStatus === 'completed') {
        patch.progress_percent = 100;
        patch.estimated_seconds_remaining = 0;
        patch.completed_at = now();
      } else if (TERMINAL.has(nextStatus)) {
        patch.completed_at = now();
      }
      const updated = await base44.asServiceRole.entities.Base44BuildTask.update(row.id, patch);
      return Response.json({ ok:true, task:updated, summary:summarize(await visibleTasks(base44, user, body)) });
    }

    return Response.json({ error:`Unsupported action: ${action}` }, { status:400 });
  } catch (error:any) {
    console.error('base44-task-queue', error);
    return Response.json({ ok:false, error:text(error?.message || error, 1000) || 'Task queue unavailable' }, { status:500 });
  }
}
