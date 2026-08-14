import { useEffect, useState } from "react";
import { Store, ShieldCheck, PackageCheck, AlertTriangle, RotateCcw, UserCheck, Lock, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function MerchantHub() {
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

  const steps = [
    [Store, "Merchant enrollment", "Capture business, contact, location and category information."],
    [ShieldCheck, "Compliance review", "Verify applicable licenses/registrations before any regulated lane can be enabled."],
    [PackageCheck, "Pickup custody", "Confirm merchant, package state and authorized pickup before departure."],
    [UserCheck, "Age & ID handoff", "Require the applicable identity/age check before completing a restricted handoff."],
    [AlertTriangle, "Refusal", "If verification fails or the handoff is prohibited, do not complete delivery."],
    [RotateCcw, "Return & audit", "Return when required and create a compliance event for the audit trail."],
  ];

  return <div className="p-4 space-y-4 pb-8">
    <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
      <div className="flex items-center gap-2 text-primary"><Store className="h-5 w-5"/><span className="text-[11px] tracking-[0.2em] font-display">LOKIN PARTNER NETWORK</span></div>
      <h1 className="text-3xl font-extrabold font-display metal-text mt-2">Merchant Hub</h1>
      <p className="text-sm text-white/55 mt-2">Onboard pilot merchants now. Regulated categories stay gated until every legal, licensing and LOKIN compliance requirement is satisfied.</p>
    </div>

    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 flex gap-3">
      <Lock className="h-5 w-5 text-amber-300 shrink-0"/><div><div className="font-bold">Cannabis lane locked</div><div className="text-xs text-white/55 mt-1">No adult-use marijuana orders or deliveries are enabled. This hub prepares the merchant workflow for Virginia's future licensed market.</div></div>
    </div>

    <div className="rounded-3xl border border-white/10 lokin-panel p-4">
      <div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-3">ADD PILOT MERCHANT</div>
      <div className="flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Business name" className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-primary/50"/><button onClick={addMerchant} disabled={saving||!name.trim()} className="rounded-xl bg-primary text-primary-foreground px-4 font-bold disabled:opacity-40"><Plus className="h-5 w-5"/></button></div>
    </div>

    <div className="space-y-2">{merchants.map(m=><div key={m.id} className="rounded-2xl border border-white/10 lokin-panel p-4 flex items-center justify-between gap-3"><div><div className="font-bold text-white">{m.name}</div><div className="text-xs text-white/45 mt-1">Pilot: {String(m.pilot_status||"interested").replaceAll("_"," ")}</div></div><span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">NON-CONTROLLED PILOT</span></div>)}</div>

    <div><div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">REGULATED HANDOFF WORKFLOW</div><div className="space-y-2">{steps.map(([Icon,title,desc],i)=><div key={title} className="rounded-2xl border border-white/10 lokin-panel p-3 flex gap-3"><div className="h-9 w-9 rounded-full border border-primary/25 bg-primary/10 flex items-center justify-center"><Icon className="h-4 w-4 text-primary"/></div><div className="flex-1"><div className="text-sm font-bold">{i+1}. {title}</div><div className="text-xs text-white/45 mt-1">{desc}</div></div></div>)}</div></div>
  </div>;
}
