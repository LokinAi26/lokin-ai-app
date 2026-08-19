import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Leaf, GraduationCap, MapPin, Package, CheckCircle2, Truck, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const FLOW = {
  placed: "Accept",
  accepted: "Mark picked up",
  picked_up: "Start delivery",
  in_transit: "Confirm delivered",
  delivered: "Done",
};
const NEXT = { placed: "accepted", accepted: "picked_up", picked_up: "in_transit", in_transit: "delivered" };

export default function GreenDelivery() {
  const { toast } = useToast();
  const [cert, setCert] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [user, certs] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.DriverCertification.filter({ program: "cannabis_training" }).catch(() => []),
      ]);
      setMe(user);
      const c = (certs || [])[0] || null;
      setCert(c);
      const eligible = c?.eligible_for_regulated_offers && c.status === "passed";
      if (eligible) {
        const [open, mine] = await Promise.all([
          base44.entities.CannabisOrder.filter({ status: "placed" }, "-created_date", 50),
          base44.entities.CannabisOrder.filter({ driver_user_id: user?.id || "none" }, "-created_date", 50),
        ]);
        const mineActive = (mine || []).filter((o) => ["accepted", "picked_up", "in_transit"].includes(o.status));
        setOrders([...mineActive, ...(open || [])]);
      } else {
        setOrders([]);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  const eligible = cert?.eligible_for_regulated_offers && cert?.status === "passed";

  async function advance(o) {
    setBusy(o.id);
    try {
      const next = NEXT[o.status];
      if (!next) return;
      const patch = { status: next };
      if (o.status === "placed") patch.driver_user_id = me?.id || null;
      if (next === "delivered") patch.completed_at = new Date().toISOString();
      await base44.entities.CannabisOrder.update(o.id, patch);
      toast({ title: next === "accepted" ? "Order accepted" : "Status updated" });
      load();
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  }

  if (loading) return <div className="p-6 text-sm text-white/40">Loading delivery board…</div>;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Leaf className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Green Delivery</h1>
      </div>

      {!eligible ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-center">
          <Lock className="h-6 w-6 text-amber-300 mx-auto mb-2" />
          <div className="text-sm font-bold text-amber-200">Cannabis certification required</div>
          <p className="text-xs text-white/55 mt-1">Complete LOKIN's cannabis delivery training to accept regulated orders.</p>
          <Link to="/certified" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-bold"><GraduationCap className="h-4 w-4" /> Get certified</Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="h-8 w-8 text-white/30 mx-auto mb-2" />
          <p className="text-sm text-white/40">No cannabis delivery orders available right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const mine = o.driver_user_id === me?.id;
            return (
              <div key={o.id} className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-white">${Number(o.total).toFixed(2)}</div>
                  <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 ${mine ? "bg-primary/15 text-primary" : "bg-white/10 text-white/60"}`}>{mine ? "YOURS" : "OPEN"}</span>
                </div>
                <div className="text-xs text-white/55">{o.dispensary} · {o.items?.length || 0} item(s)</div>
                <div className="flex items-start gap-1.5 text-xs text-white/45"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /> {o.delivery_address}{o.apt ? `, ${o.apt}` : ""}</div>
                {o.discreet && <div className="text-[10px] text-accent">Discreet packaging requested</div>}
                <div className="flex items-center gap-1.5 text-[10px] text-white/40 pt-1"><Truck className="h-3 w-3" /> {o.status.replace("_", " ")}</div>
                {o.status !== "delivered" && (
                  <button onClick={() => advance(o)} disabled={busy === o.id} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-xs font-bold active:scale-[0.98] disabled:opacity-50">
                    {busy === o.id ? "Updating…" : FLOW[o.status]}
                  </button>
                )}
                {o.status === "delivered" && <div className="flex items-center gap-1.5 text-xs text-primary justify-center"><CheckCircle2 className="h-4 w-4" /> Delivered</div>}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-white/30 text-center">ID check required on delivery · 21+ only · Sealed orders</p>
    </div>
  );
}