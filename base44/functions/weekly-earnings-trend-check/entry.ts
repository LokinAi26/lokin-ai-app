// Weekly Earnings Trend Check — compares each driver's trailing-7-day
// earnings against their average weekly earnings from the previous calendar
// month. When the trailing week drops 20%+ below that baseline, the driver
// gets a persistent in-app CopilotEvent plus an instant native push alert.
// Invoked daily by the "Earnings Trend Watch" scheduled workflow. Guarded
// like the other internal job functions: shared job key or an admin session.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { hasInternalJobKey } from '../../shared/internalJobKey.ts';

const DROP_THRESHOLD = 0.2; // alert when ≥20% below last month's weekly average
const MIN_BASELINE = 25; // ignore tiny baselines so a $25/wk history can't spam noise alerts
const COOLDOWN_DAYS = 6; // at most one trend-drop alert per driver per week
const ALERT_TITLE = 'Your weekly earnings trend is dropping';

function dayStr(d) {
  return d.toISOString().slice(0, 10);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Internal job guard: shared secret or an authenticated admin session.
    const jobKeyOk = await hasInternalJobKey(req, body);
    if (!jobKeyOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (String(user.role || '') !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dryRun = body.dryRun === true;

    // Windows: trailing 7 days vs the previous calendar month.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevEnd = new Date(monthStart.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
    const weeksInPrevMonth = prevEnd.getDate() / 7;
    const todayKey = dayStr(now);
    const weekStartKey = dayStr(new Date(now.getTime() - 7 * 86400000));
    const prevStartKey = dayStr(prevStart);
    const prevEndKey = dayStr(prevEnd);

    const earnings = await base44.asServiceRole.entities.Earning.filter({}, '-date', 500);

    // Group each driver's own earnings records.
    const byDriver = {};
    for (const r of earnings || []) {
      const uid = r.created_by_id;
      if (!uid) continue;
      if (!byDriver[uid]) byDriver[uid] = [];
      byDriver[uid].push(r);
    }

    const results = [];
    for (const [driverId, recs] of Object.entries(byDriver)) {
      const amountBetween = (fromKey, toKey) =>
        recs
          .filter((r) => (r.date || '') >= fromKey && (r.date || '') <= toKey)
          .reduce((s, r) => s + (Number(r.amount) || 0), 0);

      const weekTotal = Math.round(amountBetween(weekStartKey, todayKey) * 100) / 100;
      const prevMonthTotal = amountBetween(prevStartKey, prevEndKey);
      const prevWeeklyAvg = Math.round((prevMonthTotal / weeksInPrevMonth) * 100) / 100;

      if (prevWeeklyAvg < MIN_BASELINE) {
        results.push({ driverId, skipped: 'no meaningful previous-month baseline' });
        continue;
      }
      if (weekTotal >= prevWeeklyAvg * (1 - DROP_THRESHOLD)) {
        results.push({ driverId, status: 'ok', weekTotal, prevWeeklyAvg });
        continue;
      }

      // Cooldown: skip if this driver was already alerted within the last ~week.
      const recentAlerts = await base44.asServiceRole.entities.CopilotEvent.filter(
        { user_id: driverId, event_type: 'earnings' },
        '-created_date',
        10
      );
      const cooldownMs = COOLDOWN_DAYS * 86400000;
      const alreadyAlerted = (recentAlerts || []).some(
        (a) => a.title === ALERT_TITLE && new Date(a.created_date).getTime() > Date.now() - cooldownMs
      );
      if (alreadyAlerted) {
        results.push({ driverId, status: 'cooldown' });
        continue;
      }

      const dropPct = Math.round(((prevWeeklyAvg - weekTotal) / prevWeeklyAvg) * 100);
      const message =
        `Your last 7 days are at $${weekTotal.toFixed(0)} — about $${prevWeeklyAvg.toFixed(0)}/week ` +
        `last month. That's a ${dropPct}% drop. Open Earnings to see what changed and reset your pace.`;

      results.push({ driverId, status: 'alert', weekTotal, prevWeeklyAvg, dropPct });

      if (dryRun) continue;

      // Persistent in-app alert record (also drives the cooldown).
      try {
        await base44.asServiceRole.entities.CopilotEvent.create({
          user_id: driverId,
          event_type: 'earnings',
          priority: 'high',
          title: ALERT_TITLE,
          message,
          action_path: '/earnings',
        });
      } catch (e) {
        console.error('trend alert record failed:', e.message);
      }

      // Instant native push.
      try {
        await base44.asServiceRole.integrations.Core.SendPushNotification({
          user_id: driverId,
          title: `LOKIN AI — ${ALERT_TITLE}`,
          content: message,
          action_label: 'Open Earnings',
          action_url: '/earnings',
        });
      } catch (e) {
        console.error('trend alert push failed:', e.message);
      }
    }

    return Response.json({
      ok: true,
      checked: Object.keys(byDriver).length,
      window: { weekStartKey, prevStartKey, prevEndKey },
      results,
    });
  } catch (error) {
    console.error('weekly-earnings-trend-check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}