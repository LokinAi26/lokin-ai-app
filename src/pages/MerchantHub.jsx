import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Store, ShieldCheck, PackageCheck, AlertTriangle, RotateCcw, UserCheck, Lock, Plus, PackagePlus, Clock3, Truck, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TABS = [
  { key: "merchants", label: "Merchants" },
  { key: "orders", label: "Orders" },
];

const WORKFLOW_STEPS = [
  { Icon: Store, title: "Merchant enrollment", desc: "Capture business, contact, location and category information." },
  { Icon: ShieldCheck, title: "Compliance review", desc: "Verify applicable licenses/registrations before any regulated lane can be enabled." },
  { Icon: PackageCheck, title: "Pickup custody", desc: "Confirm merchant, package state and authorized pickup before departure." },
  { Icon: UserCheck, title: "Age & ID handoff", desc: "Require the applicable identity/age check before completing a restricted handoff." },
  { Icon: AlertTriangle, title: "Refusal", desc: "If verification fails or the handoff is prohibited, do not complete delivery." },
  { Icon: RotateCcw, title: "Return & audit", desc: "Return when required and create a compliance event for the audit trail." },
];

export default function MerchantHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "orders" ? "orders" : "merchants";
  const setTab = (t) => setParams(t === "merchants" ? {} : { tab: t }, { replace: true });

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
        <div className="flex items-center gap-2 text-primary"><Store className="h-5 w-5" /><span className="text-[11px] tracking-[0.2em] font-display">LOKIN PARTNER NETWORK</span></div>
        <h1 className="text-3xl font-extrabold font-display metal-text mt-2">Merchant Hub</h1>
        <p className="text-sm text-white/55 mt-2">Onboard pilot merchants, request pickups, and track orders. Regulated categories stay gated until every legal, licensing and LOKIN compliance requirement is satisfied.</p>
        <div className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 text-sm font-bold border transition-colors ${tab === t.key ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/55"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "merchants" ? <MerchantsTab /> : <OrdersTab />}
    </div>
  );
}

function MerchantsTab() {
  const [merchants, setMerchants] = useState([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try { setMerchants(await base44.entities.MerchantPartner.filter({})); } catch { setMerchants([]); }
  }
  useEffect(() => { load(); }, []);

  async function addMerchant() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await base44.entities.MerchantPartner.create({
        name: name.trim(),
        categories: ["non_controlled_pilot"],
        pilot_status: "interested",
        regulated_cannabis_enabled: false,
        tobacco_nicotine_enabled: false,
        non_controlled_pilot_enabled: true,
        notes: "Pilot merchant — regulated product lanes remain disabled pending applicable licensing and compliance approval."
      });
      setName(""); await load();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 flex gap-3">
        <Lock className="h-5 w-5 text-amber-300 shrink-0" /><div><div className="font-bold">Cannabis lane locked</div><div className="text-xs text-white/55 mt-1">No adult-use marijuana orders or deliveries are enabled. This hub prepares the merchant workflow for Virginia's future licensed market.</div></div>
      </div>

      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-3">ADD PILOT MERCHANT</div>
        <div className="flex gap-2"><input value={name} onChange={e => setName(e.target.value)} placeholder="Business name" className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-primary/50" /><button onClick={addMerchant} disabled={saving || !name.trim()} className="rounded-xl bg-primary text-primary-foreground px-4 font-bold disabled:opacity-40"><Plus className="h-5 w-5" /></button></div>
      </div>

      <div className="space-y-2">{merchants.map(m => <div key={m.id} className="rounded-2xl border border-white/10 lokin-panel p-4 flex items-center justify-between gap-3"><div><div className="font-bold text-white">{m.name}</div><div className="text-xs text-white/45 mt-1">Pilot: {String(m.pilot_status || "interested").replaceAll("_", " ")}</div></div><span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">NON-CONTROLLED PILOT</span></div>)}</div>

      <div><div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">REGULATED HANDOFF WORKFLOW</div><div className="space-y-2">{WORKFLOW_STEPS.map(({ Icon, title, desc }, i) => <div key={title} className="rounded-2xl border border-white/10 lokin-panel p-3 flex gap-3"><div className="h-9 w-9 rounded-full border border-primary/25 bg-primary/10 flex items-center justify-center"><Icon className="h-4 w-4 text-primary" /></div><div className="flex-1"><div className="text-sm font-bold">{i + 1}. {title}</div><div className="text-xs text-white/45 mt-1">{desc}</div></div></div>)}</div></div>
    </div>
  );
}

function OrdersTab() {
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
  const active = orders.filter((o) => !["delivered", "returned", "canceled"].includes(o.status));

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
    <div className="space-y-4">
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
          <button onClick={load} className="rounded-xl border border-white/10 p-2 text-white/60"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /></button>
        </div>
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-3 flex gap-2">
          <Lock className="h-4 w-4 text-amber-300 shrink-0" />
          <div className="text-xs text-white/55">Adult-use marijuana ordering remains disabled. Pilot requests are limited to categories that are lawful and enabled for this merchant.</div>
        </div>
        <button onClick={requestPickup} disabled={!merchant?.non_controlled_pilot_enabled || busy}
          className="mt-3 w-full rounded-2xl bg-primary text-primary-foreground py-3 font-bold disabled:opacity-40 flex items-center justify-center gap-2">
          <PackagePlus className="h-4 w-4" /> Request Pilot Pickup
        </button>
      </div>

      <div>
        <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">ORDERS</div>
        <div className="space-y-2">
          {orders.length === 0 && <div className="text-sm text-white/40 rounded-2xl border border-white/10 p-4">No merchant orders yet.</div>}
          {orders.slice(0, 12).map((o) => (
            <div key={o.id} className="rounded-2xl border border-white/10 lokin-panel p-3">
              <div className="flex justify-between gap-3"><div className="font-semibold text-sm text-white">{o.category.replaceAll("_", " ")}</div><span className="text-[11px] text-primary">{o.status.replaceAll("_", " ")}</span></div>
              <div className="text-xs text-white/45 mt-1">{o.pickup_address || "Pickup pending"}</div>
              {o.requested_at && <div className="mt-2 text-[10px] text-white/35 flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(o.requested_at).toLocaleString()}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-white/10 lokin-panel p-3 text-center"><Icon className="h-4 w-4 text-primary mx-auto mb-1" /><div className="text-lg font-bold font-display text-white">{value}</div><div className="text-[10px] text-white/40">{label}</div></div>;
}
