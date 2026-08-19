import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// Driver dispatch gateway. Surfaces merchant pickup orders to certified drivers.
// non_controlled orders are available to any signed-in driver; cannabis_future orders
// are available only to drivers who passed cannabis_training and are eligible.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    const certs = await base44.entities.DriverCertification.filter({ user_id: user.id, status: "passed" });
    const certified = certs.length > 0;
    const cannabisCert = certs.some((c) => c.program === "cannabis_training" && c.eligible_for_regulated_offers);

    if (action === "list") {
      const categoryFilter = body.category ? String(body.category) : null;
      const available = [];
      if (!categoryFilter || categoryFilter === "non_controlled") {
        const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ status: "driver_requested", category: "non_controlled" }, "-requested_at");
        (rows || []).forEach((o) => available.push(o));
      }
      if (cannabisCert && (!categoryFilter || categoryFilter === "cannabis_future")) {
        const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ status: "driver_requested", category: "cannabis_future" }, "-requested_at");
        (rows || []).forEach((o) => available.push(o));
      }
      const mine = await base44.asServiceRole.entities.MerchantOrder.filter({ assigned_driver_user_id: user.id }, "-requested_at");
      return Response.json({ available, mine: mine || [], certified, cannabis_certified: cannabisCert, regulated_enabled: cannabisCert });
    }

    if (action === "accept") {
      const id = String(body.id || "");
      if (!id) return Response.json({ error: "Order id required" }, { status: 400 });
      const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ id });
      const order = rows[0];
      if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
      if (!["non_controlled", "cannabis_future"].includes(order.category)) {
        return Response.json({ error: "This category is not enabled for dispatch" }, { status: 403 });
      }
      if (order.category === "cannabis_future" && !cannabisCert) {
        return Response.json({ error: "Cannabis certification required for this order" }, { status: 403 });
      }
      if (order.status !== "driver_requested" || order.assigned_driver_user_id) {
        return Response.json({ error: "Order is no longer available" }, { status: 409 });
      }
      const updated = await base44.asServiceRole.entities.MerchantOrder.update(id, {
        assigned_driver_user_id: user.id,
        status: "driver_assigned",
      });
      // Sync the linked CannabisOrder so the customer sees it accepted.
      if (order.category === "cannabis_future" && order.customer_reference) {
        try {
          const coRows = await base44.asServiceRole.entities.CannabisOrder.filter({ id: order.customer_reference });
          if (coRows?.[0]) await base44.asServiceRole.entities.CannabisOrder.update(coRows[0].id, { status: "accepted", driver_user_id: user.id });
        } catch (e) { console.error("driver-dispatch: cannabis accept sync failed", e); }
      }
      return Response.json({ ok: true, order: updated });
    }

    if (action === "pickup") {
      const id = String(body.id || "");
      const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ id, assigned_driver_user_id: user.id });
      const order = rows[0];
      if (!order) return Response.json({ error: "Assigned order not found" }, { status: 404 });
      const updated = await base44.asServiceRole.entities.MerchantOrder.update(id, { status: "picked_up" });
      if (order.category === "cannabis_future" && order.customer_reference) {
        try {
          const coRows = await base44.asServiceRole.entities.CannabisOrder.filter({ id: order.customer_reference });
          if (coRows?.[0]) await base44.asServiceRole.entities.CannabisOrder.update(coRows[0].id, { status: "picked_up" });
        } catch (e) { console.error("driver-dispatch: cannabis pickup sync failed", e); }
      }
      return Response.json({ ok: true, order: updated });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("driver-dispatch error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}