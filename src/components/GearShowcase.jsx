import { useMemo, useState } from "react";
import { Dumbbell, ShieldCheck, Sparkles, Truck, Zap } from "lucide-react";
import ApparelMockup from "@/components/ApparelMockup";

const COLLECTIONS = [
  { key:"core", title:"LOKIN Core", kicker:"SIGNATURE IDENTITY", icon:Sparkles, desc:"The essential LOKIN uniform — clean, recognizable and built around the master lock-clock identity.", items:[
    { variant:"tee", name:"LOKIN AI Signature Tee", sub:"Vault Black · Signature chest mark", badge:"CORE" },
    { variant:"hoodie", name:"LOKIN AI Performance Hoodie", sub:"Vault Black · Premium lockup", badge:"CORE" },
    { variant:"cap", name:"LOKIN Lock Cap", sub:"Embroidered-look lock-clock mark", badge:"CORE" },
    { variant:"shiesty", name:"LOKIN Cold-Shift Balaclava", sub:"Winter headgear · Lock emblem", badge:"CORE" },
    { variant:"sticker", name:"LOKIN AI Identity Sticker", sub:"Signature brand lockup", badge:"CORE" },
  ]},
  { key:"drive", title:"LOKIN Drive", kicker:"ROAD PERFORMANCE", icon:Truck, desc:"Purpose-built delivery and driver gear carrying the same visual language as the LOKIN cockpit.", items:[
    { variant:"delivery", name:"LOKIN Insulated Delivery Bag", sub:"Hot/cold · Driver utility", badge:"DRIVE" },
    { variant:"pizza", name:"LOKIN Pizza Bag 18", sub:'18” · Single-stack', badge:"DRIVE" },
    { variant:"pizza", name:"LOKIN Pizza Bag 20", sub:'20” · Double-stack', badge:"DRIVE" },
    { variant:"pizza", name:"LOKIN Pizza Bag 24", sub:'24” · Triple-stack', badge:"DRIVE" },
    { variant:"catering", name:"LOKIN Catering Bag", sub:"Medium · Insulated", badge:"DRIVE" },
    { variant:"catering", name:"LOKIN Catering Bag XL", sub:"Large-format delivery", badge:"DRIVE" },
    { variant:"cupholder", name:"LOKIN Drink Carrier", sub:"Multi-cup delivery support", badge:"DRIVE" },
  ]},
  { key:"performance", title:"LOKIN Performance", kicker:"MOVE · TRAIN · LEVEL UP", icon:Zap, desc:"Performance-minded pieces designed to bridge workdays, training and the LOKIN Fitness experience.", items:[
    { variant:"tee", name:"LOKIN Performance Training Tee", sub:"Training identity · Neon signal", badge:"PERFORMANCE" },
    { variant:"hoodie", name:"LOKIN Warm-Up Hoodie", sub:"Pre-shift · Pre-training layer", badge:"PERFORMANCE" },
    { variant:"socks", name:"LOKIN Performance Socks", sub:"Moisture-wicking · Daily movement", badge:"PERFORMANCE" },
    { variant:"tote", name:"LOKIN Training Tote", sub:"Gym · Work · Everyday carry", badge:"PERFORMANCE" },
  ]},
  { key:"recovery", title:"LOKIN Recovery", kicker:"RESET · RECOVER · RETURN", icon:Dumbbell, desc:"Comfort and recovery products that support long shifts and the movement side of the ecosystem.", items:[
    { variant:"seatcushion", name:"LOKIN Driver Seat Cushion", sub:"Breathable comfort support", badge:"RECOVERY" },
    { variant:"seatcushion", name:"LOKIN Lumbar Support", sub:"Long-shift comfort", badge:"RECOVERY" },
    { variant:"massagecover", name:"LOKIN Recovery Seat Cover", sub:"Vibration comfort layer", badge:"RECOVERY" },
    { variant:"socks", name:"LOKIN Thermal Recovery Socks", sub:"Cold-shift warmth", badge:"RECOVERY" },
  ]},
  { key:"protect", title:"LOKIN Protect", kicker:"VISIBILITY · PREPAREDNESS", icon:ShieldCheck, desc:"Non-weapon safety and visibility gear aligned with LOKIN's driver protection layer.", items:[
    { variant:"delivery", name:"LOKIN Reflective Driver Kit", sub:"Roadside visibility gear", badge:"PROTECT" },
    { variant:"delivery", name:"LOKIN Personal Safety Alarm", sub:"Audible alert · Keychain-ready", badge:"PROTECT" },
    { variant:"delivery", name:"LOKIN Emergency Escape Tool", sub:"Seatbelt cutter · Window breaker", badge:"PROTECT" },
  ]},
];

export default function GearShowcase() {
  const [active,setActive] = useState("all");
  const shown = useMemo(()=>active==="all"?COLLECTIONS:COLLECTIONS.filter(c=>c.key===active),[active]);
  return <div className="space-y-5">
    <div className="rounded-3xl border border-white/10 lokin-surface p-5">
      <div className="lokin-kicker">LOKIN PRODUCT UNIVERSE</div>
      <div className="mt-2 text-2xl font-bold font-heading metal-text">Built to be worn. Built to work.</div>
      <p className="mt-2 text-xs leading-relaxed text-white/50">Every catalog graphic now follows one hierarchy: Vault Black environment, metallic information, Neon Lime identity/action, and the lock-clock as the hero mark.</p>
      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[{key:"all",title:"ALL"},...COLLECTIONS.map(c=>({key:c.key,title:c.title.replace("LOKIN ","").toUpperCase()}))].map(c=><button key={c.key} onClick={()=>setActive(c.key)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-bold tracking-wider ${active===c.key?'border-primary/50 bg-primary text-black':'border-white/10 bg-white/[.03] text-white/55'}`}>{c.title}</button>)}
      </div>
    </div>

    {shown.map((s)=>{const Icon=s.icon;return <section key={s.key} className="space-y-3">
      <div className="flex items-end gap-3 px-1"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/[.07]"><Icon className="h-5 w-5 text-primary"/></div><div className="min-w-0 flex-1"><div className="text-[9px] tracking-[.2em] text-primary/70 font-display">{s.kicker}</div><div className="text-lg font-bold text-white">{s.title}</div></div><span className="text-[10px] text-white/30">{s.items.length} PIECES</span></div>
      <p className="px-1 text-xs text-white/40">{s.desc}</p>
      <div className="grid grid-cols-2 gap-3">{s.items.map((it,i)=><article key={`${it.name}-${i}`} className="lokin-product-card rounded-2xl border border-white/10 lokin-panel p-2.5">
        <div className="relative rounded-xl overflow-hidden border border-white/[.06]" style={{background:"radial-gradient(circle at 50% 38%,rgba(170,255,0,.09),rgba(2,3,4,.96) 62%)"}}>
          <div className="absolute left-2 top-2 z-10 rounded-full border border-primary/25 bg-black/75 px-2 py-1 text-[8px] font-black tracking-[.13em] text-primary">{it.badge}</div>
          <ApparelMockup variant={it.variant}/>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent"/>
        </div>
        <div className="px-1 pt-2.5"><div className="text-sm font-semibold text-white leading-tight">{it.name}</div><div className="mt-1 text-[10px] leading-snug text-white/42">{it.sub}</div></div>
      </article>)}</div>
    </section>})}
  </div>;
}
