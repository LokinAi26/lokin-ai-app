import { createClientFromRequest } from "npm:@base44/sdk";

const clean = (value:any, max=4000) =>
  String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

export default async function(req:Request) {
  const base44 = createClientFromRequest(req);
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Sign in is required to create an OASIS project." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = clean(body.title, 160);
    const idea = clean(body.idea, 6000);
    const category = clean(body.category || "Other", 80);
    const audience = clean(body.audience, 300);
    const targetPrice = Number(body.target_price);
    const targetMargin = Number(body.target_margin);

    if (!title || !idea) {
      return Response.json({ error: "Product name and idea description are required." }, { status: 400 });
    }
    if (!Number.isFinite(targetPrice) || targetPrice < 0) {
      return Response.json({ error: "Target price must be zero or greater." }, { status: 400 });
    }
    if (!Number.isFinite(targetMargin) || targetMargin < 0 || targetMargin > 100) {
      return Response.json({ error: "Target margin must be between 0 and 100." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const record = await base44.asServiceRole.entities.OasisProject.create({
      organization_id: user.organization_id || user.id,
      owner_user_id: user.id,
      title,
      idea,
      category,
      audience,
      target_price: targetPrice,
      target_margin: targetMargin,
      status: "idea",
      approval_state: "draft",
      brand_score: 0,
      production_score: 0,
      demand_score: 0,
      profit_score: 0,
      next_action: "Develop concept",
      created_at: now,
      updated_at: now,
    });

    return Response.json({
      success: true,
      project: record,
      disclosure: "OASIS project saved. No provider called, credits spent, product manufactured, or external commitment made.",
    });
  } catch (error:any) {
    console.error("oasis-project-create", error);
    return Response.json(
      { error: clean(error?.message || error, 1000) || "OASIS project could not be saved." },
      { status: 500 },
    );
  }
}
