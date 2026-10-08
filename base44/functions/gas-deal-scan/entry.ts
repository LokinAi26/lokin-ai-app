// LOKIN Local Gas Deal Scan (2026-10-08): a Google-Search-backed scan for
// CURRENT gas prices and discount programs in the driver's region. Verified
// deals are upserted into FuelDeal, which the Fuel page and the navigation
// FuelDealsOverlay already read — so the cheapest pumps appear along the
// active route right after a scan. Only published figures are stored; nothing
// is invented. Matches the scanOpportunities pattern: driver session or the
// shared LOKIN_INTERNAL_JOB_KEY for scheduled runs.
import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hasInternalJobKey } from '../../shared/internalJobKey.ts';

const DEFAULT_REGION = 'Hampton Roads, VA';
const MAX_DEALS = 12;

function buildPrompt(region: string) {
  return `You are LOKIN AI's local fuel-discovery engine. Search the public web NOW (Google search) for CURRENT, VERIFIABLE gas price and discount information for drivers in and around ${region}.

Look for:
1. Cheapest gas stations in the area with a PUBLISHED price per gallon right now (GasBuddy-style price reports, station price pages, local news price roundups).
2. Current fuel discount programs available locally: fuel cashback apps (e.g. Upside), grocery loyalty fuel discounts (e.g. Kroger, Food Lion, Safeway fuel points), warehouse club fuel savings, and gas station chain app discounts.
3. Promo codes or signup bonuses for those cashback/fuel apps ONLY if published on the program's own page or a reputable deal page.

STRICT RULES:
- Only return facts you actually found on a live page. Never invent prices, discounts, addresses, or codes.
- price_per_gallon is the published regular-grade price in dollars per gallon.
- discount_per_gallon: only for an actual cents-off-per-gallon discount tied to a loyalty/app program; otherwise 0.
- cashback_percent: only for a published cashback rate tied to filling up there; otherwise 0.
- promo_code: only a published code; otherwise empty string.
- address: the station's street address when found; otherwise empty.
- expires_on: leave empty unless the page states an end date.
- If you cannot verify at least one price, return an empty deals array.

For each deal return: station, address, price_per_gallon, discount_per_gallon, cashback_percent, promo_code, expires_on, source (page/site where found).
Return up to ${MAX_DEALS} verified deals as JSON only.`;
}

function cleanDeal(o: any) {
  const station = String(o?.station || '').trim();
  const price = Number(o?.price_per_gallon);
  if (!station || !Number.isFinite(price) || price < 0.5 || price > 10) return null;
  const discount = Number(o?.discount_per_gallon);
  const cashback = Number(o?.cashback_percent);
  const expires = String(o?.expires_on || '').trim();
  return {
    station: station.slice(0, 120),
    address: String(o?.address || '').trim().slice(0, 200),
    price_per_gallon: Math.round(price * 100) / 100,
    discount_per_gallon: Number.isFinite(discount) && discount > 0 && discount < 2 ? Math.round(discount * 100) / 100 : 0,
    cashback_percent: Number.isFinite(cashback) && cashback > 0 && cashback < 50 ? cashback : 0,
    promo_code: String(o?.promo_code || '').trim().slice(0, 40),
    expires_on: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? expires : new Date().toISOString().slice(0, 10),
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const jobKeyOk = await hasInternalJobKey(req, body);
    if (!jobKeyOk && !user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const region = String(body?.region || DEFAULT_REGION).trim().slice(0, 160) || DEFAULT_REGION;
    const llm = await invokeLLMWithAdmission(base44, {
      prompt: buildPrompt(region),
      add_context_from_internet: true,
      model: 'gemini_3_8_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          deals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                station: { type: 'string' },
                address: { type: 'string' },
                price_per_gallon: { type: 'number' },
                discount_per_gallon: { type: 'number' },
                cashback_percent: { type: 'number' },
                promo_code: { type: 'string' },
                expires_on: { type: 'string' },
                source: { type: 'string' },
              },
              required: ['station', 'price_per_gallon'],
            },
          },
        },
        required: ['deals'],
      },
    });

    const raw = Array.isArray(llm?.deals) ? llm.deals : [];
    const deals = raw.map(cleanDeal).filter(Boolean).slice(0, MAX_DEALS);

    // Upsert by station name so re-scans refresh prices instead of piling up
    // duplicate rows; driver-saved deals that the scan did not find are kept.
    let created = 0;
    let updated = 0;
    if (deals.length) {
      const existing = await base44.asServiceRole.entities.FuelDeal.filter({}, '-created_date', 300);
      const byStation = new Map<string, any>();
      for (const rec of existing) byStation.set(String(rec.station || '').trim().toLowerCase(), rec);
      for (const deal of deals) {
        const key = deal.station.toLowerCase();
        const match = byStation.get(key);
        try {
          if (match) {
            await base44.asServiceRole.entities.FuelDeal.update(match.id, {
              address: deal.address || match.address,
              price_per_gallon: deal.price_per_gallon,
              discount_per_gallon: deal.discount_per_gallon,
              cashback_percent: deal.cashback_percent,
              promo_code: deal.promo_code || match.promo_code,
              expires_on: deal.expires_on,
            });
            updated += 1;
          } else {
            await base44.asServiceRole.entities.FuelDeal.create(deal);
            created += 1;
          }
        } catch (e) {
          console.warn('fuel deal upsert failed:', (e as Error)?.message || e);
        }
      }
    }

    return Response.json({
      ok: true,
      region,
      scanned_at: new Date().toISOString(),
      found: raw.length,
      created,
      updated,
    });
  } catch (error) {
    console.error('gas-deal-scan error:', error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Gas deal scan failed' }, { status: 500 });
  }
}