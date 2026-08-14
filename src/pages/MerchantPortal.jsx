import { useEffect, useMemo, useState } from "react";
import { Store, PackagePlus, UserCheck, ShieldCheck, Clock3, Truck, RefreshCw, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function MerchantPortal() {
  const [me, setMe] = useState(null);
  const [partners, setPartners] = useState([]);
  const [orders, setOrders] = useState([]);
  const [certs, setCerts] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const user = await base44.auth.me();
      setMe(user);
      const [p, o, c] = await Promise.all([
        base44.entities.MerchantPartner.filter({}),
        base44.entities.MerchantOrder.filter({}, "-created_date"),
        base44.entities.DriverCertification.filter({ status: "passed" }, "-completed_at"),
      ]);
      setPartners(p || []);
      setOrders(o || []);
      setCerts(c || []);
    } finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  const merchant = partners[0];
  const certifiedDrivers = useMemo(() => certs.filter((x) => x.eligible_for_regulated_offers === true), [certs]);
  const active = orders.filter((o) => !["delivered","returned","canceled"].includes(o.status));

  async function requestPickup() {
    if (!merchant?.id || !me?.id) return;
    await base44.entities.MerchantOrder.create({
      merchant_id: merchant.id,
      merchant_user_id: me.id,
      category: "non_controlled",
      status: "driver_requested",
      pickup_address: merchant.address || "",
      requested_at: new Date().toISOString(),
      sealed_order_required: false,
      id_check_required: false,
      notes: "Pilot request — non-controlled merchandise only.",
    });
    await load();
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
        <div className="flex items-center gap-2 text-primary"><Store className="h-5 w-5"/><span className="text-[11px] tracking-[0.2em] font-display">MERCHANT PORTAL</span></div>
        <h1 className="text-3xl font-extrabold font-display metal-text mt-2">LOKIN Merchant</h1>
        <p className="text-sm text-white/55 mt-2">Request pickups, track orders, view certified-driver availability, and review compliance records.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Truck} label="Active" value={active.length} />
        <Stat icon={UserCheck} label="Eligible" value={certifiedDrivers.length} />
        <Stat icon={ShieldCheck} label="Pilot" value={merchant?.non_controlled_pilot_enabled ? "ON" : "OFF"} />
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-white">{merchant?.name || "Merchant profile"}</div>
            <div className="text-xs text-white/45 mt-1">{merchant?.pilot_status || "Not onboarded"}</div>
          </div>
          <button onClick={load} className="rounded-xl border border-white/10 p-2 text-white/60"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}/></button>
        </div>
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-3 flex gap-2">
          <Lock className="h-4 w-4 text-amber-300 shrink-0" />
          <div className="text-xs text-white/55">Adult-use marijuana ordering remains disabled. Pilot requests are limited to categories that are lawful and enabled for this merchant.</div>
        </div>
        <button onClick={requestPickup} disabled={!merchant?.non_controlled_pilot_enabled || busy}
          className="mt-3 w-full rounded-2xl bg-primary text-primary-foreground py-3 font-bold disabled:opacity-40 flex items-center justify-center gap-2">
          <PackagePlus className="h-4 w-4"/> Request Pilot Pickup
        </button>
      </div>

      <div>
        <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">ORDERS</div>
        <div className="space-y-2">
          {orders.length === 0 && <div className="text-sm text-white/40 rounded-2xl border border-white/10 p-4">No merchant orders yet.</div>}
          {orders.slice(0,12).map((o) => (
            <div key={o.id} className="rounded-2xl border border-white/10 lokin-panel p-3">
              <div className="flex justify-between gap-3"><div className="font-semibold text-sm text-white">{o.category.replaceAll("_"," ")}</div><span className="text-[11px] text-primary">{o.status.replaceAll("_"," ")}</span></div>
              <div className="text-xs text-white/45 mt-1">{o.pickup_address || "Pickup pending"}</div>
              {o.requested_at && <div className="mt-2 text-[10px] text-white/35 flex items-center gap-1"><Clock3 className="h-3 w-3"/>{new Date(o.requested_at).toLocaleString()}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({icon:Icon,label,value}) {
  return <div className="rounded-2xl border border-white/10 lokin-panel p-3 text-center"><Icon className="h-4 w-4 text-primary mx-auto mb-1"/><div className="text-lg font-bold font-display text-white">{value}</div><div className="text-[10px] text-white/40">{label}</div></div>;
}
