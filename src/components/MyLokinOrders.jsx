import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, ExternalLink, Loader2, PackageCheck, Truck } from "lucide-react";
import { guardedInvoke } from "@/lib/creditGuardian";

const label = (s) => String(s || "pending").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

export default function MyLokinOrders() {
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { (async () => { try { const r = await guardedInvoke(base44, "my-lokin-orders", {}); setOrders(r?.data?.orders || []); } catch(e) { setError(e?.response?.data?.error || e?.message || "Unable to load orders"); } finally { setLoading(false); } })(); }, []);
  if (loading) return <section className="rounded-3xl border border-white/10 lokin-panel p-5 text-center text-xs text-white/45"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary"/>Loading your LOKIN orders…</section>;
  return <section className="rounded-3xl border border-primary/20 lokin-panel p-4 space-y-3">
    <div><div className="text-[11px] tracking-[.24em] text-primary/80 font-display">MY LOKIN ORDERS</div><div className="text-lg font-black text-white">From lock-in to doorstep</div><div className="text-xs text-white/45">Private order status matched to your signed-in account.</div></div>
    {error && <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/50">{error}</div>}
    {!error && orders.map(o => { const fs = o.fulfillments?.[0]; const urls = fs?.tracking_urls || []; return <div key={o.id} className="rounded-2xl border border-white/10 bg-black/35 p-3 space-y-3">
      <div className="flex justify-between gap-3"><div><div className="font-bold text-white">{o.name || `Order ${o.id}`}</div><div className="text-[10px] text-white/35">{o.created_at ? new Date(o.created_at).toLocaleDateString() : ""}</div></div><div className="font-black text-primary">{new Intl.NumberFormat("en-US",{style:"currency",currency:o.currency||"USD"}).format(Number(o.total_price||0))}</div></div>
      <div className="grid grid-cols-3 gap-1 text-center text-[9px] font-bold"><div className="rounded-lg bg-primary/10 p-2 text-primary"><CheckCircle2 className="mx-auto h-3.5 w-3.5"/>PAID</div><div className={`rounded-lg p-2 ${o.fulfillment_status !== "unfulfilled" ? "bg-primary/10 text-primary" : "bg-white/5 text-white/30"}`}><PackageCheck className="mx-auto h-3.5 w-3.5"/>PRINTED</div><div className={`rounded-lg p-2 ${urls.length ? "bg-primary/10 text-primary" : "bg-white/5 text-white/30"}`}><Truck className="mx-auto h-3.5 w-3.5"/>TRACKED</div></div>
      <div className="text-[10px] text-white/45">Payment: {label(o.financial_status)} · Fulfillment: {label(o.fulfillment_status)}</div>
      {o.items?.length > 0 && <div className="space-y-1">{o.items.slice(0,4).map((i,n)=><div key={n} className="text-xs text-white/55">{i.quantity}× {i.title}{i.variant_title ? ` · ${i.variant_title}` : ""}</div>)}</div>}
      {urls.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-xs font-black text-primary">TRACK PACKAGE {fs?.tracking_numbers?.[i] ? `· ${fs.tracking_numbers[i]}` : ""}<ExternalLink className="h-3.5 w-3.5"/></a>)}
    </div>})}
    {!error && !orders.length && <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-xs text-white/40">No orders are linked to this signed-in email yet. After checkout, matching orders will appear here.</div>}
  </section>;
}
