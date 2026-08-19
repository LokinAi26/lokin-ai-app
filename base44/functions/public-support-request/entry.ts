import { createClientFromRequest } from "npm:@base44/sdk@0.8.43";

export default async function(req: Request) {
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().slice(0, 320);
    const message = String(body.message || "").trim().slice(0, 4000);
    if (!email || !message || !email.includes("@")) return Response.json({ error: "Valid email and message required" }, { status: 400 });
    const base44 = createClientFromRequest(req);
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
