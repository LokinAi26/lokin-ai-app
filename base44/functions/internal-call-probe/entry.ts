import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// TEMPORARY diagnostic: reports how a request reaches a backend function
// (auth context + header keys) so internal job invocations can be gated
// without client-controlled flags. Secret-bearing header values are masked.
// The result is also written to the Temp scratch entity so workflow-invoked
// runs (whose HTTP response cannot be inspected from run logs) can be read.
export default async function(req: Request) {
  try {
    const base44: any = createClientFromRequest(req);
    let me: any = null;
    let authed: any = null;
    let meError: string | null = null;
    try { me = await base44.auth.me(); } catch (e: any) { meError = String(e?.message || e).slice(0, 200); }
    try { authed = await base44.auth.isAuthenticated(); } catch (e: any) { authed = 'error:' + String(e?.message || e).slice(0, 120); }

    const headers: Record<string, string> = {};
    try {
      req.headers.forEach((value: string, key: string) => {
        const masked = /authorization|token|key|secret|cookie/i.test(key);
        headers[key] = masked ? `${value.slice(0, 14)}…(len:${value.length})` : value.slice(0, 160);
      });
    } catch {}

    const result: any = {
      probe: 'internal-call-context',
      hasUser: Boolean(me),
      user: me ? { id: me.id, role: me.role, emailDomain: (me.email || '').split('@')[1] || '' } : null,
      isAuthenticated: authed,
      meError,
      headerKeys: Object.keys(headers),
      headers,
    };
    console.log('PROBE_RESULT', JSON.stringify(result));
    try {
      await base44.asServiceRole.entities.Temp.create({ x: JSON.stringify(result).slice(0, 3000) });
    } catch (e: any) {
      console.log('PROBE_PERSIST_FAILED', String(e?.message || e).slice(0, 200));
    }
    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}