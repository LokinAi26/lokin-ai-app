// LOKIN Opportunity Scanner — runs a live web scan of Hampton Roads for newly
// available delivery & courier opportunities across gig apps, W-2 driver jobs,
// 1099/independent courier routes, medical/package courier work, legal cannabis
// delivery, and legal alcohol delivery. Persists results to OpportunityScan.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const REGION = "Hampton Roads, Virginia";

const PROMPT = `You are LOKIN AI's opportunity scanner. Search the web for NEWLY AVAILABLE delivery and courier
work currently hiring in ${REGION} (Norfolk, Virginia Beach, Chesapeake, Portsmouth, Suffolk, Hampton, Newport News,
and surrounding Southside/Peninsula areas).

Cover ALL of these categories and prefer legitimate, recently posted openings:
1. Gig delivery apps (DoorDash, Uber Eats, Instacart, Amazon Flex, Grubhub, Shipt, Roadie, Spark by Walmart, GoPuff, etc.)
2. W-2 employed delivery driver jobs (local delivery, route drivers, auto parts, furniture, beverage, courier)
3. 1099 / independent contractor courier routes and owner-operator box-truck/cargo-van work
4. Medical courier work (lab specimens, pharmacy, medical delivery — requires clean record, often 21+)
5. Package / parcel courier work (FedEx Ground contractors, OnTrac, regional carriers)
6. Legal cannabis delivery opportunities where legally available in Virginia (must be state-legal; note any
   badging/ID-verification/permit requirements). Skip any illegal/unlicensed postings.
7. Legal alcohol delivery opportunities (Drizly, Minibar, local package-store delivery, restaurant alcohol delivery)
   — include any ID-verification / alcohol-server certification requirements and publicly listed pay.

For each opportunity return:
- title (short role name)
- company (employer or platform)
- category (one of: gig_app, w2_driver, courier_1099, medical_courier, package_courier, cannabis_delivery, alcohol_delivery, other)
- role_type (one of: personal_car, cargo_van, box_truck, any)
- pay (publicly listed pay as a short string, e.g. "$25/hr", "$1.50/mile", "$200/day", "per delivery")
- pay_amount (a single normalized number estimate in USD per hour for sorting; 0 if not listed)
- employment_type ("W-2", "1099", "gig", "contract", or similar)
- vehicle_requirements (concise: e.g. "21+, valid license, 4-door car 1998+", "cargo van or box truck")
- qualifications (concise: background check, age, certification, etc.)
- location (city/area within Hampton Roads)
- apply_url (a real link to apply if found, or empty string)
- source (where the listing was found, e.g. "Indeed", "DoorDash", "company careers page")
- notes (1 short line; for cannabis/alcohol add ID/cert requirements if any)

Prioritize real, currently-open postings. Aim for 10-25 opportunities. Do NOT fabricate pay or links —
if a field is unknown leave it empty or 0. Return only valid JSON matching the schema.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // The scheduled workflow runs as service role; a manual run from the UI is
    // an authenticated user. Either way, Core.InvokeLLM must run as service role.
    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: PROMPT,
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
                employment_type: { type: "string" },
                vehicle_requirements: { type: "string" },
                qualifications: { type: "string" },
                location: { type: "string" },
                apply_url: { type: "string" },
                source: { type: "string" },
                notes: { type: "string" }
              },
              required: ["title", "category"]
            }
          }
        },
        required: ["opportunities"]
      }
    });

    const opps = Array.isArray(llm?.opportunities) ? llm.opportunities : [];
    const today = new Date().toISOString().slice(0, 10);

    const records = opps.map((o) => ({
      scan_date: today,
      region: REGION,
      title: o.title,
      company: o.company || "",
      category: o.category || "other",
      role_type: o.role_type || "any",
      pay: o.pay || "",
      pay_amount: Number(o.pay_amount) || 0,
      employment_type: o.employment_type || "",
      vehicle_requirements: o.vehicle_requirements || "",
      qualifications: o.qualifications || "",
      location: o.location || "",
      apply_url: o.apply_url || "",
      source: o.source || "",
      notes: o.notes || "",
      is_new: true
    })).filter((r) => r.title);

    let created = [];
    if (records.length > 0) {
      created = await base44.asServiceRole.entities.OpportunityScan.bulkCreate(records);
    }

    return Response.json({
      ok: true,
      scan_date: today,
      region: REGION,
      found: opps.length,
      saved: created.length
    });
  } catch (error) {
    console.error("scanOpportunities error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}