import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { balanceWorkloads, ecosystemEngineSummary, ECOSYSTEM_FABRIC_VERSION } from '../../shared/ecosystemWorkloadFabric.js';

const now = () => new Date().toISOString();

function safeString(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const workloads = Array.isArray(body.workloads)
      ? body.workloads.slice(0, 100)
      : body.workload && typeof body.workload === 'object'
        ? [body.workload]
        : [];

    if (!workloads.length) {
      return Response.json({
        ok: false,
        error: 'Provide workload or workloads[].',
        version: ECOSYSTEM_FABRIC_VERSION,
        engines: ecosystemEngineSummary(),
      }, { status: 400 });
    }

    const snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : {};
    const result = balanceWorkloads(workloads, snapshot);
    const persist = body.persist !== false;

    if (persist) {
      const sourceApp = safeString(body.source_app || body.sourceApp, 'LOKIN AI');
      for (let i = 0; i < result.decisions.length; i += 1) {
        const decision = result.decisions[i];
        const source = workloads[i] || {};
        await base44.entities.EcosystemWorkloadDecision.create({
          workload_id: decision.workloadId,
          idempotency_key: decision.idempotencyKey,
          source_app: sourceApp,
          domain: safeString(source.domain),
          workload_type: safeString(source.type || source.category),
          ...(decision.engineId ? { engine_id: decision.engineId } : {}),
          ...(decision.engineName ? { engine_name: decision.engineName } : {}),
          status: decision.status,
          accepted: !!decision.accepted,
          priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 50,
          ...(Number.isFinite(Number(decision.score)) ? { score: Number(decision.score) } : {}),
          reason: decision.reason,
          ...(Number.isFinite(Number(decision.leaseMs)) ? { lease_ms: Number(decision.leaseMs) } : {}),
          ...(Number.isFinite(Number(decision.retryAfterMs)) ? { retry_after_ms: Number(decision.retryAfterMs) } : {}),
          decision_version: decision.decisionVersion,
          decided_at: now(),
        });
      }
    }

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('ecosystem-workload-balance', error);
    return Response.json({ ok: false, error: 'Workload balancing failed safely.' }, { status: 500 });
  }
}
