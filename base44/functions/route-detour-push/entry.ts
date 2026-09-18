import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Instant faster-route push alert. The navigation engine (client-side) detects
// the faster route during a shift; this function delivers the native mobile
// push to the driver who made the request — it can only ever push to self.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // Bounded input: 1–120 minutes, computed server-side from savings seconds.
    const savingsMin = Math.max(1, Math.min(120, Math.round(Number(body?.savings_s || 0) / 60) || 1));

    try {
      await base44.asServiceRole.integrations.Core.SendPushNotification({
        user_id: user.id,
        title: 'LOKIN AI — Faster route found',
        content: `A faster route just opened up — save about ${savingsMin} minute${savingsMin === 1 ? '' : 's'} on your remaining stops. Tap to apply it.`,
        action_label: 'Open LOKIN GPS',
        action_url: '/ai-gps',
      });
      return Response.json({ ok: true, delivered: true });
    } catch (pushError) {
      // Native push requires push credentials in the mobile build. Until those
      // are configured the send fails — report it so the failure is visible in
      // logs while the in-app, voice, and web-notification paths still work.
      return Response.json({ ok: true, delivered: false, error: pushError.message });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}