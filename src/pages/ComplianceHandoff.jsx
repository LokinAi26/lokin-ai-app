import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ScanLine, CheckCircle2, XCircle, RotateCcw, AlertTriangle, PackageCheck } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ComplianceHandoff(){
 const [params]=useSearchParams(); const navigate=useNavigate(); const orderId=params.get("order")||"";
 const [step,setStep]=useState(0); const [status,setStatus]=useState("ready"); const [note,setNote]=useState(""); const [order,setOrder]=useState(null); const [loading,setLoading]=useState(Boolean(orderId));

 useEffect(()=>{(async()=>{if(!orderId)return; try{const rows=await base44.entities.MerchantOrder.filter({id:orderId});setOrder(rows?.[0]||null);}finally{setLoading(false);}})();},[orderId]);
 const steps=useMemo(()=>[
  "Confirm order and sealed pickup requirements",
  "Verify the intended recipient is present",
  order?.id_check_required ? "Check acceptable ID and required age" : "Confirm no regulated ID check is required",
  "Confirm lawful handoff",
  "Complete audit record",
 ],[order?.id_check_required]);

 async function log(category,result,reason=""){
  try{const me=await base44.auth.me(); await base44.entities.ComplianceEvent.create({user_id:me?.id||"",merchant_id:order?.merchant_id||"",delivery_reference:orderId,category,result,reason,occurred_at:new Date().toISOString(),audit_note:note});}catch{}
 }
 async function pass(){
  const category=step===0?"pickup_custody":step===2?(order?.id_check_required?"id_verified":"age_check"):step>=3?"handoff":"age_check";
  await log(category,step===2&&!order?.id_check_required?"not_applicable":"pass");
  if(step<4){setStep(step+1);return;}
  if(orderId){try{await base44.entities.MerchantOrder.update(orderId,{status:"delivered",completed_at:new Date().toISOString()});}catch{}}
  setStatus("complete");
 }
 async function refuse(){
  await log(step===2&&order?.id_check_required?"id_failed":"refusal","refused","Verification or lawful-handoff requirement not satisfied");
  if(orderId){try{await base44.entities.MerchantOrder.update(orderId,{status:"refused"});}catch{}}
  setStatus("refused");
 }
 async function returned(){
  await log("return_to_merchant","returned","Order returned under compliance workflow");
  if(orderId){try{await base44.entities.MerchantOrder.update(orderId,{status:"returned",completed_at:new Date().toISOString()});}catch{}}
  setStatus("returned");
 }

 return <div className="p-4 space-y-4 pb-8">
  <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5"><div className="flex gap-2 text-primary"><ShieldCheck className="h-5 w-5"/><span className="text-[11px] tracking-[0.2em] font-display">LOKIN COMPLIANCE</span></div><h1 className="text-3xl font-extrabold font-display metal-text mt-2">Verified Handoff</h1><p className="text-sm text-white/55 mt-2">Complete the delivery with a guided refusal-safe audit trail.</p></div>
  {orderId&&<div className="rounded-2xl border border-white/10 lokin-panel p-3 flex items-center gap-3"><PackageCheck className="h-5 w-5 text-primary"/><div className="min-w-0"><div className="text-xs text-white/40">ACTIVE MERCHANT ORDER</div><div className="text-sm font-bold text-white capitalize">{loading?"Loading…":order?.category?.replaceAll("_"," ")||"Order unavailable"}</div><div className="text-[11px] text-white/45 truncate">{order?.dropoff_address||order?.pickup_address||orderId}</div></div></div>}
  {status==="ready"&&<><div className="rounded-3xl border border-white/10 lokin-panel p-4"><div className="flex items-center justify-between"><div><div className="text-xs text-white/40">STEP {step+1} OF {steps.length}</div><div className="font-bold text-white mt-1">{steps[step]}</div></div><ScanLine className="h-6 w-6 text-primary"/></div><div className="h-1.5 bg-white/5 rounded-full mt-4 overflow-hidden"><div className="h-full bg-primary" style={{width:`${((step+1)/steps.length)*100}%`}}/></div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional compliance note" className="w-full mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm min-h-20 outline-none focus:border-primary/50"/></div><div className="grid grid-cols-2 gap-2"><button onClick={pass} className="rounded-2xl bg-primary text-primary-foreground py-3 font-bold flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4"/>PASS</button><button onClick={refuse} className="rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive py-3 font-bold flex items-center justify-center gap-2"><XCircle className="h-4 w-4"/>REFUSE</button></div></>}
  {status==="complete"&&<div className="rounded-3xl border border-primary/35 bg-primary/[0.07] p-6 text-center"><CheckCircle2 className="h-12 w-12 text-primary mx-auto"/><div className="font-display text-xl font-extrabold text-primary mt-3">HANDOFF VERIFIED</div><div className="text-xs text-white/50 mt-2">Delivery completed and the audit trail was recorded.</div><button onClick={()=>navigate("/driver-dispatch")} className="mt-4 rounded-2xl border border-primary/30 px-4 py-2 text-sm font-bold text-primary">Back to Dispatch</button></div>}
  {status==="refused"&&<div className="rounded-3xl border border-destructive/35 bg-destructive/[0.06] p-5"><AlertTriangle className="h-8 w-8 text-destructive"/><div className="font-bold mt-2">Delivery refused</div><div className="text-xs text-white/50 mt-1">Do not leave an order that cannot lawfully be handed off. Follow the merchant return workflow.</div><button onClick={returned} className="mt-4 w-full rounded-2xl border border-white/15 py-3 font-bold flex items-center justify-center gap-2"><RotateCcw className="h-4 w-4"/>CONFIRM RETURN TO MERCHANT</button></div>}
  {status==="returned"&&<div className="rounded-3xl border border-primary/30 lokin-panel p-6 text-center"><RotateCcw className="h-10 w-10 text-primary mx-auto"/><div className="font-bold mt-2">Return recorded</div><div className="text-xs text-white/50 mt-1">The refusal and return are now part of the compliance audit trail.</div><button onClick={()=>navigate("/driver-dispatch")} className="mt-4 rounded-2xl border border-primary/30 px-4 py-2 text-sm font-bold text-primary">Back to Dispatch</button></div>}
  <div className="text-[11px] text-white/35 text-center">Regulated categories remain gated unless applicable law, licensing, merchant eligibility, and driver requirements are satisfied.</div>
 </div>;
}
