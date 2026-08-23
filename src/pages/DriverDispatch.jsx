import { useEffect, useState } from "react";
import { PackageCheck, RefreshCw, MapPin, Navigation, ShieldCheck, Lock, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function DriverDispatch() {
  const navigate = useNavigate();
  const [data, setData] = useState({ available: [], mine: [], certified: false, regulated_enabled: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true); setError("");
    try {
      const res = await base44.functions.invoke("driver-dispatch", { action: "list" });
      setData(res.data || res);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  async function accept(order) {
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "accept", id: order.id });
      await load();
      navigate(`/ai-gps?focus=locked&order=${encodeURIComponent(order.id)}&destination=${encodeURIComponent(order.pickup_address || "")}`);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  async function pickup(order) {
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "pickup", id: order.id });
      await load();
      navigate(`/ai-gps?focus=locked&order=${encodeURIComponent(order.id)}&destination=${encodeURIComponent(order.dropoff_address || "")}`);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
        <div className="flex items-center gap-2 text-primary"><Truck className="h-5 w-5"/><span className="text-[11px] tracking-[0.2em] font-display">DRIVER DISPATCH</span></div>
        <h1 className="text-3xl font-extrabold font-display metal-text mt-2">Merchant Pickups</h1>
        <p className="text-sm text-white/55 mt-2">Accept an eligible merchant pickup, then LOKIN launches distraction-free AI GPS automatically.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><PackageCheck className="h-5 w-5 text-primary mb-2"/><div className="text-2xl font-bold font-display">{data.available?.length || 0}</div><div className="text-[11px] text-white/40">Available pilot pickups</div></div>
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><ShieldCheck className="h-5 w-5 text-accent mb-2"/><div className="text-sm font-bold mt-1">{data.certified ? "Training on file" : "Academy available"}</div><div className="text-[11px] text-white/40 mt-1">Regulated eligibility remains separately gated.</div></div>
      </div>

      <div className={`rounded-2xl border p-3 flex gap-2 ${data.cannabis_certified ? "border-primary/25 bg-primary/[0.05]" : "border-amber-400/20 bg-amber-400/[0.05]"}`}>
        <Lock className={`h-4 w-4 shrink-0 mt-0.5 ${data.cannabis_certified ? "text-primary" : "text-amber-300"}`}/>
        <div className="text-xs text-white/55">{data.cannabis_certified ? "You're cannabis-certified — regulated cannabis pickup orders are available to accept." : "Non-controlled merchandise only. Complete cannabis training in LOKIN Certified to unlock regulated deliveries."}</div>
      </div>

      <button onClick={load} className="w-full rounded-2xl border border-white/10 lokin-panel py-3 text-sm font-semibold text-white/70 flex justify-center items-center gap-2"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}/>Refresh offers</button>
      {error && <div className="text-sm text-destructive">{error}</div>}

      <section>
        <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">AVAILABLE</div>
        <div className="space-y-2">
          {!data.available?.length && <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/40">No merchant pickup requests are waiting right now.</div>}
          {(data.available || []).map((o) => <OrderCard key={o.id} order={o} actionLabel="ACCEPT & LOCK IN" onAction={() => accept(o)} busy={busy}/>) }
        </div>
      </section>

      <section>
        <div className="text-xs tracking-[0.18em] text-accent/75 font-display mb-2">MY ACTIVE PICKUPS</div>
        <div className="space-y-2">
          {(data.mine || []).filter(o => !["delivered","returned","canceled","refused"].includes(o.status)).map((o) => (
            <OrderCard key={o.id} order={o} actionLabel={o.status === "driver_assigned" ? "CONFIRM PICKUP & NAVIGATE" : o.status === "picked_up" ? "VERIFY HANDOFF" : "OPEN LOCKED GPS"} onAction={() => o.status === "driver_assigned" ? pickup(o) : o.status === "picked_up" ? navigate(`/compliance-handoff?order=${encodeURIComponent(o.id)}`) : navigate(`/ai-gps?focus=locked&order=${encodeURIComponent(o.id)}&destination=${encodeURIComponent(o.status === "driver_assigned" ? (o.pickup_address || "") : (o.dropoff_address || o.pickup_address || ""))}`)} busy={busy}/>
          ))}
        </div>
      </section>
    </div>
  );
}

function OrderCard({ order, actionLabel, onAction, busy }) {
  return <div className="rounded-3xl border border-white/10 lokin-panel p-4">
    <div className="flex items-start justify-between gap-3"><div><div className="font-bold text-white capitalize">{order.category?.replaceAll("_"," ")}</div><div className="text-xs text-primary mt-0.5 capitalize">{order.status?.replaceAll("_"," ")}</div></div><Navigation className="h-5 w-5 text-primary"/></div>
    <div className="mt-3 space-y-1 text-xs text-white/50"><div className="flex gap-2"><MapPin className="h-3.5 w-3.5 text-primary shrink-0"/>{order.pickup_address || "Pickup address pending"}</div>{order.dropoff_address && <div className="flex gap-2"><MapPin className="h-3.5 w-3.5 text-accent shrink-0"/>{order.dropoff_address}</div>}</div>
    <button onClick={onAction} disabled={busy} className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground py-3 font-bold disabled:opacity-40">{actionLabel}</button>
  </div>;
}