import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  CONTROL_PLANE_VERSION,
  controlPlaneHealth,
  createControlCheckpoint,
  exportControlEnvelope,
  putControlState,
  resolveControlState,
  revokeControlState,
} from '../../shared/unifiedControlPlane.js';

const SOURCE_APP = 'LOKIN AI';
const text = (v:any, max=4000) => String(v ?? '').trim().slice(0, max);

export default async function(req:Request) {
  const base44 = createClientFromRequest(req);
  try {
    if (req.method !== 'POST') return Response.json({ error:'Method not allowed' }, { status:405 });
    const user:any = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error:'Unauthorized' }, { status:401 });
    const actor = { userId:user.id, role:user.role };
    const body:any = await req.json().catch(() => ({}));
    const action = text(body.action || 'health', 40).toLowerCase();

    if (action === 'put') {
      if (!body.canonical_key) return Response.json({ error:'canonical_key is required' }, { status:400 });
      if (!body.owner_user_id) body.owner_user_id = user.id;
      if (body.owner_user_id !== user.id && user.role !== 'admin') return Response.json({ error:'Forbidden' }, { status:403 });
      const result = await putControlState(base44, { ...body, source_app:SOURCE_APP }, actor);
      return Response.json({ ok:true, version:CONTROL_PLANE_VERSION, ...result });
    }

    if (action === 'resolve') {
      if (!body.canonical_key) return Response.json({ error:'canonical_key is required' }, { status:400 });
      const result = await resolveControlState(base44, { ...body, source_app:SOURCE_APP }, actor);
      return Response.json({ ok:result.resolved, ...result }, { status:result.error ? 409 : 200 });
    }

    if (action === 'checkpoint') {
      const result = await createControlCheckpoint(base44, { ...body, source_app:SOURCE_APP }, actor);
      return Response.json({ ok:true, version:CONTROL_PLANE_VERSION, ...result });
    }

    if (action === 'health') {
      const result = await controlPlaneHealth(base44, { ...body, source_app:SOURCE_APP }, actor);
      return Response.json({ ok:result.status !== 'action_required', ...result });
    }

    if (action === 'revoke') {
      if (!body.state_id) return Response.json({ error:'state_id is required' }, { status:400 });
      const state = await revokeControlState(base44, body.state_id, actor, SOURCE_APP);
      return Response.json({ ok:true, state, version:CONTROL_PLANE_VERSION });
    }

    if (action === 'export') {
      if (!body.state_id) return Response.json({ error:'state_id is required' }, { status:400 });
      const state:any = await base44.asServiceRole.entities.LokinControlState.get(text(body.state_id, 180)).catch(() => null);
      if (!state) return Response.json({ error:'CONTROL_STATE_NOT_FOUND' }, { status:404 });
      if (state.owner_user_id !== user.id && user.role !== 'admin') return Response.json({ error:'Forbidden' }, { status:403 });
      return Response.json({ ok:true, envelope:exportControlEnvelope(state), version:CONTROL_PLANE_VERSION });
    }

    return Response.json({ error:`Unsupported action: ${action}` }, { status:400 });
  } catch (error:any) {
    const message = text(error?.message || error, 1000) || 'Control plane unavailable';
    const code = /REQUIRED|INVALID/.test(message) ? 400 : /FORBIDDEN|ADMIN/.test(message) ? 403 : /CONFLICT|LOCKED|HASH|VERSION/.test(message) ? 409 : 500;
    console.error('unified-control-plane', message);
    return Response.json({ ok:false, error:message, version:CONTROL_PLANE_VERSION }, { status:code });
  }
}
