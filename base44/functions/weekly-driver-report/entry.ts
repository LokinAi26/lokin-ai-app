// Weekly Driver Report — emails the driver's weekly mileage, tax savings, and
// session earnings summary. Invoked by the "Weekly Driver Report" scheduled
// workflow (Sundays 6pm local). Guarded by LOKIN_INTERNAL_JOB_KEY with an
// admin-session fallback (the workflow runtime invokes as the app owner).
// Email: connected Gmail connector (gmail.send) via the shared helper.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { hasInternalJobKey } from '../../shared/internalJobKey.ts';
import { getGmailSender, gmailSendMessage } from '../../shared/gmailSend.ts';

// IRS standard mileage rate — matches the rate used across LOKIN's mileage
// tracking and tax export tools.
const MILEAGE_RATE = 0.70;

function dayStr(d) {
  return d.toISOString().slice(0, 10);
}

function deductionOf(record) {
  const stored = Number(record.deduction) || 0;
  if (stored > 0) return stored;
  return (Number(record.miles) || 0) * MILEAGE_RATE;
}

function fmtMoney(n) {
  return `$${Number(n).toFixed(2)}`;
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

    // Resolve the report recipient: explicit email arg, the invoking admin
    // (workflow runtime invokes as the app owner), or all admins as fallback.
    let recipients = [];
    if (body.email) {
      recipients = [{ email: String(body.email).trim(), id: null }];
    } else {
      const invoking = await base44.auth.me().catch(() => null);
      if (invoking && invoking.email) {
        recipients = [{ email: invoking.email, id: invoking.id }];
      } else {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        recipients = (admins || [])
          .filter((a) => a.email)
          .map((a) => ({ email: a.email, id: a.id }));
      }
    }
    recipients = recipients.filter((r) => r.email);
    if (!recipients.length) {
      return Response.json({ error: 'No report recipient could be resolved' }, { status: 400 });
    }

    const { token: gmailToken, fromEmail } = await getGmailSender(base44);
    if (!gmailToken) {
      return Response.json({ sent: false, reason: 'Gmail not connected' }, { status: 200 });
    }

    // Weekly window: the 7 days ending now.
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const windowStart = dayStr(weekStart);

    let sent = 0;
    const reports = [];

    for (const recipient of recipients) {
      // Scope each driver's records to their own data when the user id is known.
      const scope = recipient.id ? { created_by_id: recipient.id } : {};

      const [earnings, mileage, sessions] = await Promise.all([
        base44.asServiceRole.entities.Earning.filter(scope, '-date', 500),
        base44.asServiceRole.entities.MileageLog.filter(scope, '-date', 500),
        base44.asServiceRole.entities.DriverSession.filter(scope, '-created_date', 200),
      ]);

      const weekEarnings = (earnings || []).filter((r) => (r.date || '') >= windowStart);
      const allBusinessMileage = (mileage || []).filter(
        (r) => (r.type || 'business') === 'business'
      );
      const weekMileage = allBusinessMileage.filter((r) => (r.date || '') >= windowStart);

      const gross = weekEarnings.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const tips = weekEarnings.reduce((s, r) => s + (Number(r.tips) || 0), 0);
      const bonuses = weekEarnings.reduce((s, r) => s + (Number(r.bonuses) || 0), 0);
      const trips = weekEarnings.reduce((s, r) => s + (Number(r.trips) || 0), 0);

      const weeklyMiles = weekMileage.reduce((s, r) => s + (Number(r.miles) || 0), 0);
      const weeklyTaxSavings = weekMileage.reduce((s, r) => s + deductionOf(r), 0);
      const totalTaxSavings = allBusinessMileage.reduce((s, r) => s + deductionOf(r), 0);

      const weekSessions = (sessions || []).filter((s) => {
        const t = s.started_at ? new Date(s.started_at).getTime() : null;
        return t != null && t >= weekStart.getTime();
      });
      let sessionHours = 0;
      for (const s of weekSessions) {
        if (s.started_at && s.ended_at) {
          const hrs = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000;
          if (hrs > 0) sessionHours += hrs;
        }
      }
      const avgPerHour = sessionHours > 0 ? gross / sessionHours : 0;

      const rangeLabel =
        `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const subject = `LOKIN AI — Weekly Driver Report (${rangeLabel})`;
      const bodyText =
        `Your LOKIN AI weekly report for ${rangeLabel}:\n\n` +
        `SESSION EARNINGS\n` +
        `  Gross earnings: ${fmtMoney(gross)}\n` +
        `  Tips: ${fmtMoney(tips)} · Bonuses: ${fmtMoney(bonuses)}\n` +
        `  Trips logged: ${trips}\n` +
        `  Work sessions: ${weekSessions.length} (${sessionHours.toFixed(1)} hrs)\n` +
        `  Average: ${fmtMoney(avgPerHour)}/hr\n\n` +
        `MILEAGE & TAX SAVINGS\n` +
        `  Business miles this week: ${weeklyMiles.toFixed(1)}\n` +
        `  Tax savings this week: ${fmtMoney(weeklyTaxSavings)} (at $${MILEAGE_RATE.toFixed(2)}/mi)\n` +
        `  Total tax savings to date: ${fmtMoney(totalTaxSavings)}\n\n` +
        `Open LOKIN AI > Earnings for full breakdowns and CSV tax exports.\n\n` +
        `— LOKIN AI`;

      try {
        await gmailSendMessage(gmailToken, fromEmail, recipient.email, '', subject, bodyText);
        sent++;
        reports.push({ to: recipient.email, gross, weeklyMiles, weeklyTaxSavings, totalTaxSavings, sessions: weekSessions.length });
      } catch (e) {
        console.error('weekly report email failed:', e.message);
        reports.push({ to: recipient.email, error: e.message });
      }
    }

    return Response.json({ sent, reports, windowStart });
  } catch (error) {
    console.error('weekly-driver-report error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}