import { createClientFromRequest } from "npm:@base44/sdk@0.8.43";
import { checkRateLimit } from "../../shared/rateLimit.ts";

export default async function(req: Request) {
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const body = await req.json().catch(() => ({}));
    // Honeypot: bots fill hidden fields that humans never see. Pretend success
    // so automated submitters move on instead of adapting.
    if (body.website || body.company_website || body.url) {
      return Response.json({ ok: true });
    }
    const base44 = createClientFromRequest(req);
    const rl = await checkRateLimit(base44, req, { key: "public-support-request", limit: 3, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    const email = String(body.email || "").trim().slice(0, 320);
    const message = String(body.message || "").trim().slice(0, 4000);
    if (!email || !message || !email.includes("@")) return Response.json({ error: "Valid email and message required" }, { status: 400 });
    await base44.asServiceRole.entities.PublicSupportRequest.create({
      email,
      message,
      status: "new",
      created_at: new Date().toISOString(),
      source: "public-support-page"
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("public-support-request failed", error);
    return Response.json({ error: "Support request could not be submitted" }, { status: 500 });
  }
}
