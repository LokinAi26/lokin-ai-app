import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
// LOKIN Live Opportunity Engine
// Live-only discovery for driver jobs, mystery shopping, food review, product testing,
// and paid field/research work. Results are persisted only after their public URLs
// are reachable during the current scan. The UI separately enforces a freshness TTL.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const DEFAULT_REGION = "Hampton Roads, Virginia";
const MAX_RESULTS = 30;

const JOB_CATEGORIES = [
  "gig_app", "w2_driver", "courier_1099", "medical_courier", "package_courier",
  "cannabis_delivery", "alcohol_delivery", "warehouse", "other",
];
const FIELD_CATEGORIES = ["mystery_shop", "food_review", "product_test", "paid_research", "survey"];

function cleanMode(value: unknown) {
  return value === "gigs" || value === "all" ? String(value) : "jobs";
}

function categoriesFor(mode: string) {
  if (mode === "gigs") return FIELD_CATEGORIES;
  if (mode === "all") return [...JOB_CATEGORIES, ...FIELD_CATEGORIES];
  return JOB_CATEGORIES;
}

function safeHttpUrl(value: unknown) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

async function verifyReachableUrl(value: unknown) {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LOKINOpportunityVerifier/1.0)",
        "accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });
    try { await response.body?.cancel(); } catch {}
    if (response.status < 200 || response.status >= 400) return null;
    const finalUrl = safeHttpUrl(response.url || url);
    return finalUrl || url;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(region: string, mode: string) {
  const categories = categoriesFor(mode);
  const focus = mode === "gigs"
    ? `Search specifically for CURRENTLY AVAILABLE paid mystery shopper, restaurant/food evaluation, food taste/review research, product testing, paid consumer research, and legitimate survey/field-assignment opportunities. Favor official mystery-shopping companies, research firms, restaurant/consumer panels, and company opportunity pages. Do not return generic articles describing how to become a mystery shopper.`
    : mode === "all"
      ? `Search for CURRENTLY AVAILABLE driver/courier employment plus paid mystery shopping, food evaluation/review research, product testing, paid research, and field assignments.`
      : `Search for CURRENTLY AVAILABLE delivery, courier, driver, warehouse/dock, medical courier, package-delivery, and legitimate gig-platform work.`;

  return `You are LOKIN AI's LIVE opportunity discovery engine. Search the public web NOW for opportunities currently open in or reasonably accessible from ${region}.

${focus}

Allowed category values: ${categories.join(", ")}.

STRICT LIVE-ONLY RULES:
- Return only a specific opportunity that appears open right now.
- Every result MUST have a real source_url for the page where you found the opportunity AND a real apply_url or opportunity signup page.
- Prefer the employer/platform/research company's official page. A reputable job-board listing is acceptable when it points to a specific current opening.
- Do not invent employers, pay, dates, URLs, assignments, reimbursement, or availability.
- Do not return old blog posts, generic "how to apply" pages, search-result pages, expired postings, or example opportunities.
- If pay is not publicly shown, leave pay empty and pay_amount 0.
- If a posting/public page includes a posting date, return posted_at in ISO-compatible form; otherwise leave it empty.
- For mystery shopping/food review/product testing, do not imply LOKIN pays the worker. Return the actual third-party company/platform and its real signup/application link.
- Cannabis/alcohol roles must be legal/licensed opportunities; otherwise omit them.

For each result return:
- title
- company
- category
- role_type: personal_car | cargo_van | box_truck | any
- pay (only published pay)
- pay_amount (normalized hourly-equivalent number only when reasonably derivable from published pay; otherwise 0)
- pay_basis: hourly | per_delivery | per_trip | per_mile | daily | weekly | salary | per_task
- employment_type
- schedule: flexible | fixed_shifts | on_demand | part_time | full_time
- vehicle_requirements
- qualifications
- location
- apply_url
- source (publisher/employer/platform name)
- source_url
- posted_at
- notes

Return up to ${MAX_RESULTS} legitimate results as JSON only.`;
}

async function verifyOpportunity(o: any, allowed: string[]) {
  const title = String(o?.title || "").trim();
  const company = String(o?.company || "").trim();
  const category = allowed.includes(String(o?.category)) ? String(o.category) : "";
  if (!title || !company || !category) return null;

  const [applyUrl, sourceUrl] = await Promise.all([
    verifyReachableUrl(o?.apply_url),
    verifyReachableUrl(o?.source_url),
  ]);
  if (!applyUrl || !sourceUrl) return null;

  return {
    title,
    company,
    platform: company,
    category,
    role_type: ["personal_car", "cargo_van", "box_truck", "any"].includes(o?.role_type) ? o.role_type : "any",
    pay: String(o?.pay || "").trim(),
    pay_amount: Number(o?.pay_amount) > 0 ? Number(o.pay_amount) : 0,
    pay_source: "advertised",
    pay_basis: ["hourly", "per_delivery", "per_trip", "per_mile", "daily", "weekly", "salary", "per_task"].includes(o?.pay_basis) ? o.pay_basis : "hourly",
    employment_type: String(o?.employment_type || "").trim(),
    schedule: ["flexible", "fixed_shifts", "on_demand", "part_time", "full_time"].includes(o?.schedule) ? o.schedule : "flexible",
    est_weekly_hours: 0,
    est_weekly_miles: 0,
    vehicle_requirements: String(o?.vehicle_requirements || "").trim(),
    qualifications: String(o?.qualifications || "").trim(),
    location: String(o?.location || "").trim(),
    apply_url: applyUrl,
    source: String(o?.source || company).trim(),
    source_url: sourceUrl,
    posted_at: String(o?.posted_at || "").trim(),
    notes: String(o?.notes || "").trim(),
  };
}

async function verifyInBatches(opps: any[], allowed: string[]) {
  const out: any[] = [];
  for (let i = 0; i < Math.min(opps.length, MAX_RESULTS); i += 6) {
    const batch = opps.slice(i, i + 6);
    const results = await Promise.all(batch.map((o) => verifyOpportunity(o, allowed)));
    out.push(...results.filter(Boolean));
  }
  const seen = new Set<string>();
  return out.filter((o) => {
    const key = String(o.apply_url).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Scheduled workflows may execute without an interactive user. Service role is
    // used only after request creation; manual app scans remain authenticated.
    const body = await req.json().catch(() => ({}));
    const mode = cleanMode(body?.mode);
    if (!user && body?.scheduled !== true) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const region = String(body?.region || DEFAULT_REGION).trim().slice(0, 160) || DEFAULT_REGION;
    const allowed = categoriesFor(mode);
    const llm = await invokeLLMWithAdmission(base44, {
      prompt: buildPrompt(region, mode),
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          opportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                company: { type: "string" },
                category: { type: "string" },
                role_type: { type: "string" },
                pay: { type: "string" },
                pay_amount: { type: "number" },
                pay_basis: { type: "string" },
                employment_type: { type: "string" },
                schedule: { type: "string" },
                vehicle_requirements: { type: "string" },
                qualifications: { type: "string" },
                location: { type: "string" },
                apply_url: { type: "string" },
                source: { type: "string" },
                source_url: { type: "string" },
                posted_at: { type: "string" },
                notes: { type: "string" },
              },
              required: ["title", "company", "category", "apply_url", "source_url"],
            },
          },
        },
        required: ["opportunities"],
      },
    });

    const raw = Array.isArray(llm?.opportunities) ? llm.opportunities : [];
    const verified = await verifyInBatches(raw, allowed);
    const now = new Date();
    const nowIso = now.toISOString();
    const today = nowIso.slice(0, 10);
    const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();

    const records = verified.map((o) => ({
      ...o,
      scan_date: today,
      region,
      verified_at: nowIso,
      retrieved_at: nowIso,
      expires_at: expiresAt,
      live_status: "live",
      is_new: true,
    }));

    let created: any[] = [];
    if (records.length) created = await base44.asServiceRole.entities.OpportunityScan.bulkCreate(records);

    return Response.json({
      ok: true,
      mode,
      region,
      scanned_at: nowIso,
      raw_found: raw.length,
      verified_live: created.length,
      rejected_unverified: Math.max(0, raw.length - created.length),
      freshness_minutes: 360,
    });
  } catch (error) {
    console.error("scanOpportunities error:", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Live opportunity scan failed" }, { status: 500 });
  }
}
