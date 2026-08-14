import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// Driver dispatch gateway. During the pilot, only non-controlled merchant orders
// are surfaced. Regulated lanes stay technically gated until their legal,
// licensing, merchant, and driver requirements are enabled.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    const certs = await base44.entities.DriverCertification.filter({ user_id: user.id, status: "passed" });
    const certified = certs.length > 0;

    if (action === "list") {
      const available = await base44.asServiceRole.entities.MerchantOrder.filter({
        status: "driver_requested",
        category: "non_controlled",
      }, "-requested_at");
      const mine = await base44.asServiceRole.entities.MerchantOrder.filter({
        assigned_driver_user_id: user.id,
      }, "-requested_at");
      return Response.json({ available, mine, certified, regulated_enabled: false });
    }

    if (action === "accept") {
      const id = String(body.id || "");
      if (!id) return Response.json({ error: "Order id required" }, { status: 400 });
      const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ id });
      const order = rows[0];
      if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
      if (order.category !== "non_controlled") return Response.json({ error: "This category is not enabled for pilot dispatch" }, { status: 403 });
      if (order.status !== "driver_requested" || order.assigned_driver_user_id) return Response.json({ error: "Order is no longer available" }, { status: 409 });
      const updated = await base44.asServiceRole.entities.MerchantOrder.update(id, {
        assigned_driver_user_id: user.id,
        status: "driver_assigned",
      });
      return Response.json({ ok: true, order: updated });
    }

    if (action === "pickup") {
      const id = String(body.id || "");
      const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ id, assigned_driver_user_id: user.id });
      const order = rows[0];
      if (!order) return Response.json({ error: "Assigned order not found" }, { status: 404 });
      const updated = await base44.asServiceRole.entities.MerchantOrder.update(id, { status: "picked_up" });
      return Response.json({ ok: true, order: updated });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("driver-dispatch error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
