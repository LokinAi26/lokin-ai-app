import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Leaf, PackageCheck, Truck, MapPin, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Live tracking for a buyer's LOKIN Green (cannabis) orders.
// Subscribes to CannabisOrder realtime updates so the moment a driver accepts,
// picks up, or completes handoff, the customer sees it — closing the
// order-to-doorstep loop end-to-end.

const STAGES = [
  { key: "placed", label: "Order placed", icon: Clock },
  { key: "paid", label: "Payment confirmed", icon: CheckCircle2 },
  { key: "accepted", label: "Driver assigned", icon: Truck },
  { key: "picked_up", label: "Picked up", icon: PackageCheck },
  { key: "delivered", label: "Delivered", icon: MapPin },
];

// payment_status "paid" advances past "placed"; order status maps the rest.
function stageIndex(order) {
  if (order.status === "delivered") return 4;
  if (order.status === "picked_up" || order.status === "in_transit") return 3;
  if (order.status === "accepted") return 2;
  if (order.payment_status === "paid") return 1;
  return 0;
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

export default function GreenOrderTracker({ limit = 3 }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const me = await base44.auth.me();
      if (!me?.id) { setLoading(false); return; }
      const rows = await base44.entities.CannabisOrder.filter(
        { buyer_user_id: me.id },
        "-created_date",
        20
      );
      setOrders(rows || []);
    } catch (e) {
      /* not signed in or no orders */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Push live status updates the instant a driver or the webhook changes an order.
    const unsub = base44.entities.CannabisOrder.subscribe((event) => {
      const e = event?.data;
      if (!e) return;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === e.id);
        if (idx === -1) return [e, ...prev].slice(0, 20);
        const next = [...prev];
        next[idx] = { ...next[idx], ...e };
        return next;
      });
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/10 lokin-panel p-4 flex items-center gap-2 text-xs text-white/45">
        <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading your orders…
      </section>
    );
  }

  if (!orders.length) return null;

  const visible = orders.slice(0, limit);

  return (
    <section className="rounded-3xl border border-primary/20 lokin-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-primary" />
          <div className="text-[11px] tracking-[0.22em] text-primary/80 font-display">YOUR GREEN ORDERS</div>
        </div>
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" title="Live" />
      </div>

      <div className="space-y-3">
        {visible.map((o) => {
          const idx = stageIndex(o);
          const canceled = o.status === "canceled";
          return (
            <div key={o.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {(o.items || []).map((i) => `${i.qty || 1}× ${i.name}`).join(" · ") || "Green order"}
                  </div>
                  <div className="text-[10px] text-white/40 mt-0.5">
                    {o.dispensary || "LOKIN Green"} · {timeAgo(o.created_date)}
                  </div>
                </div>
                <div className="text-sm font-display font-bold text-primary shrink-0">
                  ${Number(o.total || 0).toFixed(2)}
                </div>
              </div>

              {canceled ? (
                <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive font-semibold">
                  Order canceled — you were not charged.
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between">
                  {STAGES.map((s, i) => {
                    const done = i <= idx;
                    const Icon = s.icon;
                    return (
                      <div key={s.key} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center gap-1 min-w-0">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${done ? "border-primary bg-primary/15 text-primary" : "border-white/15 bg-white/5 text-white/30"}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className={`text-[8px] leading-tight text-center ${done ? "text-primary" : "text-white/30"}`}>{s.label}</div>
                        </div>
                        {i < STAGES.length - 1 && (
                          <div className={`h-0.5 flex-1 mx-1 rounded ${i < idx ? "bg-primary" : "bg-white/10"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {o.status !== "delivered" && !canceled && o.dropoff && (
                <div className="mt-2 flex items-start gap-1.5 text-[10px] text-white/45">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-accent" />
                  <span className="truncate">Delivering to {o.delivery_address}{o.apt ? `, ${o.apt}` : ""}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <Link to="/support" className="text-[10px] text-white/35 underline">Question about an order? Ask LOKIN Support</Link>
      </div>
    </section>
  );
}