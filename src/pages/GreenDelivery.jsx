import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, GraduationCap, MapPin, Lock, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function GreenDelivery() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState({ available: [], mine: [], cannabis_certified: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => { load(); }, []);

  // Live refresh: the moment a new cannabis dispatch order is created, the board reloads so the
  // driver sees it without pulling-to-refresh.
  useEffect(() => {
    const unsub = base44.entities.MerchantOrder.subscribe((event) => {
      if (event.type === "create") load();
    });
    return unsub;
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("driver-dispatch", { action: "list", category: "cannabis_future" });
      setData(res.data || res);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  async function accept(o) {
    setBusy(o.id);
    try {
      await base44.functions.invoke("driver-dispatch", { action: "accept", id: o.id });
      toast({ title: "Order accepted" });
      load();
    } catch (e) { toast({ title: "Accept failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(null); }
  }
  async function pickup(o) {
    setBusy(o.id);
    try {
      await base44.functions.invoke("driver-dispatch", { action: "pickup", id: o.id });
      load();
    } catch (e) { toast({ title: "Update failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="p-6 text-sm text-white/40">Loading delivery board…</div>;
  const certified = data.cannabis_certified;
  const mine = (data.mine || []).filter((o) => o.category === "cannabis_future" && !["delivered", "returned", "canceled", "refused"].includes(o.status));
  const available = data.available || [];

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Leaf className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Green Delivery</h1>
      </div>

      {!certified ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-center">
          <Lock className="h-6 w-6 text-amber-300 mx-auto mb-2" />
          <div className="text-sm font-bold text-amber-200">Cannabis certification required</div>
          <p className="text-xs text-white/55 mt-1">Complete LOKIN's cannabis delivery training to accept regulated orders.</p>
          <div className="mt-3 flex flex-col gap-2">
            <Link to="/onboarding" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-xs font-bold glow-primary active:scale-95 transition-transform"><GraduationCap className="h-4 w-4" /> Start onboarding</Link>
            <Link to="/certified" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-white/5 px-4 py-2 text-xs font-bold text-primary/80">Just the training</Link>
          </div>
        </div>
      ) : (
        <>
          <section>
            <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">AVAILABLE CANNABIS ORDERS</div>
            <div className="space-y-2">
              {available.length === 0 && <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/40">No cannabis orders waiting right now.</div>}
              {available.map((o) => <Card key={o.id} o={o} busy={busy} onAction={() => accept(o)} label="ACCEPT & LOCK IN" />)}
            </div>
          </section>
          <section>
            <div className="text-xs tracking-[0.18em] text-accent/75 font-display mb-2">MY ACTIVE ORDERS</div>
            <div className="space-y-2">
              {mine.length === 0 && <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/40">No active cannabis deliveries.</div>}
              {mine.map((o) => (
                <Card key={o.id} o={o} busy={busy}
                  onAction={o.status === "driver_assigned" ? () => pickup(o) : () => navigate(`/compliance-handoff?order=${encodeURIComponent(o.id)}`)}
                  label={o.status === "driver_assigned" ? "CONFIRM PICKUP" : "VERIFY HANDOFF"} />
              ))}
            </div>
          </section>
        </>
      )}
      <p className="text-[10px] text-white/30 text-center">ID check required on delivery · 21+ only · Sealed orders</p>
    </div>
  );
}

function Card({ o, busy, onAction, label }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-white capitalize">{o.status?.replaceAll("_", " ")}</div>
        <ShieldCheck className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-start gap-1.5 text-xs text-white/55"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /> {o.pickup_address || "Pickup pending"}</div>
      {o.dropoff_address && <div className="flex items-start gap-1.5 text-xs text-white/45"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" /> {o.dropoff_address}</div>}
      <button onClick={onAction} disabled={busy === o.id} className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-xs font-bold active:scale-[0.98] disabled:opacity-50">
        {busy === o.id ? "…" : label}
      </button>
    </div>
  );
}