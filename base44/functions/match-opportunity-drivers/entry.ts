// Guarded by LOKIN_INTERNAL_JOB_KEY — redeployed 2026-09-15 (deploy retry 3).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hasInternalJobKey } from '../../shared/internalJobKey.ts';

// Matches a newly created OpportunityScan against drivers opted into alerts.
// Matching criteria: vehicle type (opportunity.role_type vs driver vehicle_type),
// region (opportunity.region vs driver region), and the driver's high-value pay
// threshold (opportunity_alert_min_pay vs opportunity.pay_amount). For each
// match, writes an in-app OpportunityAlert and emails the driver. Service role.
// read every driver's preferences and email across all users.
// Normalize the listed pay into an hourly figure for the driver's high-value
// bar. Uses the stored pay_amount when present; otherwise parses the listed
// pay string (hourly/daily/weekly, low end of a range) and marks the result
// estimated. An unknown pay basis returns 0 so it never silently passes the bar.
function normalizePay(opp) {
  const stored = Number(opp.pay_amount || 0);
  if (stored > 0) return { pay: stored, estimated: false };
  const pay = String(opp.pay || '').toLowerCase();
  if (!pay) return { pay: 0, estimated: false };
  const nums = (pay.match(/\$?\d[\d,]*(?:\.\d+)?/g) || [])
    .map((s) => parseFloat(s.replace(/[$,]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return { pay: 0, estimated: false };
  const low = Math.min(...nums);
  if (/per hour|\/ ?hr|\/ ?hour|hourly/.test(pay)) return { pay: low, estimated: true };
  if (/per day|\/ ?day|daily/.test(pay)) return { pay: low / 8, estimated: true };
  if (/per week|\/ ?wk|\/ ?week|weekly/.test(pay)) return { pay: low / 40, estimated: true };
  return { pay: 0, estimated: false };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Every invocation is guarded by the shared LOKIN_INTERNAL_JOB_KEY.
    // Interactive calls without it fall back to an authenticated admin session
    // (the workflow runtime invokes this as the app owner).
    const jobKeyOk = await hasInternalJobKey(req, body);
    if (!jobKeyOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (String(user.role || '') !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const opportunityId = body.opportunity_id;
    if (!opportunityId) {
      return Response.json({ error: 'opportunity_id is required' }, { status: 400 });
    }

    const opp = await base44.asServiceRole.entities.OpportunityScan.get(opportunityId);
    if (!opp) {
      return Response.json({ error: 'opportunity not found' }, { status: 404 });
    }

    const oppRole = (opp.role_type || 'any').toLowerCase();
    const oppRegion = (opp.region || '').trim().toLowerCase();
    // Strip trailing state labels so "Hampton Roads, VA" and
    // "Hampton Roads, Virginia" compare as the same market.
    const regionBase = (r) =>
      String(r || '').trim().toLowerCase()
        .replace(/,?\s*(va|virginia|nc|north carolina|md|maryland|sc|south carolina|dc)\.?$/, '')
        .trim();
    const oppRegionBase = regionBase(oppRegion);
    // Hourly-normalized pay figure compared against each driver's high-value bar.
    const payInfo = normalizePay(opp);
    const oppPay = payInfo.pay;

    const prefs = await base44.asServiceRole.entities.DriverPreference.filter(
      { alert_enabled: true },
      '-created_date',
      500
    );

    const matched = [];
    for (const pref of prefs) {
      const userId = pref.created_by_id;
      if (!userId) continue;

      const driverVehicle = (pref.vehicle_type || '').toLowerCase();
      const driverRegion = (pref.region || '').trim().toLowerCase();

      // Vehicle match: opportunity accepts any, or driver's vehicle fits the role.
      const vehicleOk =
        oppRole === 'any' ||
        !driverVehicle ||
        driverVehicle === 'other' ||
        driverVehicle === oppRole;

      // Region match: if either side is blank, treat as a match (broadest reach).
      // Compares the market name with state labels stripped, plus raw-string
      // containment for longer labels like "Hampton Roads, VA" vs "Hampton Roads".
      const driverRegionBase = regionBase(driverRegion);
      const regionOk =
        !oppRegion ||
        !driverRegion ||
        (oppRegionBase && oppRegionBase === driverRegionBase) ||
        (oppRegionBase && driverRegionBase && (oppRegionBase.includes(driverRegionBase) || driverRegionBase.includes(oppRegionBase))) ||
        oppRegion.includes(driverRegion) ||
        driverRegion.includes(oppRegion);

      // High-value filter: when the driver sets a minimum-pay bar, only
      // opportunities whose normalized pay figure clears it trigger an alert.
      const minPay = Number(pref.opportunity_alert_min_pay || 0);
      if (minPay > 0 && oppPay < minPay) continue;

      if (!vehicleOk || !regionOk) continue;

      // Idempotency guard: skip if an alert already exists for this driver + opportunity.
      const existing = await base44.asServiceRole.entities.OpportunityAlert.filter({
        user_id: userId,
        opportunity_id: opportunityId
      });
      if (existing && existing.length) {
        matched.push({ user_id: userId, skipped: true });
        continue;
      }

      const reasons = [];
      if (minPay > 0) {
        reasons.push(payInfo.estimated
          ? `high-value ~$${oppPay.toFixed(0)}/hr (estimated from "${opp.pay}")`
          : `high-value ${opp.pay || '$' + oppPay}`);
      }
      if (oppRegion && driverRegion) reasons.push(`region "${opp.region}"`);
      if (oppRole !== 'any' && driverVehicle && driverVehicle !== 'other') {
        reasons.push(`vehicle ${driverVehicle.replace(/_/g, ' ')}`);
      }
      const matchReason = reasons.length
        ? `Matches your ${reasons.join(' and ')}`
        : 'New opportunity in your area';

      let emailed = false;
      try {
        const user = await base44.asServiceRole.entities.User.get(userId);
        if (user && user.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: `New opportunity match: ${opp.title}`,
            body: [
              `A new opportunity matching your profile was just added to the LOKIN Driver Opportunity Hub.`,
              ``,
              `${opp.title}`,
              `${opp.company || opp.platform || ''}${opp.pay ? ' · ' + opp.pay : ''}`,
              `${opp.location || opp.region || ''}`,
              ``,
              `${matchReason}.`,
              ``,
              `Open the LOKIN app → Driver Opportunity Hub to view and apply.`,
              ``,
              `— LOKIN AI`
            ].join('\n')
          });
          emailed = true;
        }
      } catch (e) {
        // Email is best-effort; the in-app alert still lands.
        console.warn('opportunity alert email failed for user', String(userId).slice(0, 8), e?.message || e);
      }

      await base44.asServiceRole.entities.OpportunityAlert.create({
        user_id: userId,
        opportunity_id: opportunityId,
        opportunity_title: opp.title,
        company: opp.company || opp.platform || '',
        category: opp.category || '',
        pay: opp.pay || '',
        location: opp.location || opp.region || '',
        match_reason: matchReason,
        read: false,
        emailed
      });

      matched.push({ user_id: userId, emailed });
    }

    return Response.json({
      opportunity_id: opportunityId,
      matched_count: matched.length,
      matches: matched
    });
  } catch (error) {
    console.error('match-opportunity-drivers error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}