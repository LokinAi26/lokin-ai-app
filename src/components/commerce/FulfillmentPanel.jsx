import { useState } from "react";
import { Truck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { money, badge } from "./format";

export default function FulfillmentPanel({ orders, currency, invokeShopify, onRefresh, bridge }) {
  const [busyId, setBusyId] = useState(null);
  const [errId, setErrId] = useState(null);

  function eligible(o) {
    const s = o.fulfillment_status;
    return !s || s === "null" || s === "partial";
  }

  async function markFulfilled(o) {
    if (busyId) return;
    setBusyId(o.id);
    setErrId(null);
    try {
      const res = await invokeShopify("fulfillOrder", { id: o.id }, true);
      bridge?.toast?.(res?.fulfillment?.id ? "Order marked fulfilled in Shopify" : "Fulfillment created in Shopify");
      if (onRefresh) await onRefresh();
    } catch (e) {
      setErrId(o.id);
      bridge?.toast?.(e?.message || "Could not fulfill order", true);
    } finally {
      setBusyId(null);
    }
  }

  const unfulfilled = orders.filter(eligible);
  const tracked = orders.filter((o) => o.tracking_url || o.tracking_number);

  return (
    <section className="rounded-3xl border border-accent/20 lokin-panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.24em] text-accent/80 font-display">
        <Truck className="h-3.5 w-3.5" /> FULFILLMENT & TRACKING · {unfulfilled.length} PENDING
      </div>
      {unfulfilled.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-center text-xs text-white/40">All orders fulfilled.</div>
      ) : (
        <div className="space-y-2">
          {unfulfilled.slice(0, 12).map((o) => {
            const busy = busyId === o.id;
            const err = errId === o.id;
            return (
              <div key={o.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">{o.name || `Order ${o.id}`}</div>
                    <div className="text-[10px] text-white/35">{o.customer?.email || "No customer"} · {o.items_count} item{o.items_count === 1 ? "" : "s"}</div>
                  </div>
                  <div className="text-sm font-black text-primary">{money(o.total_price, o.currency || currency)}</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent">{badge(o.financial_status)}</span>
                  {o.line_items?.map((it, i) => (
                    <span key={i} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-white/50">{it.title} ×{it.quantity}</span>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => markFulfilled(o)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold text-black disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    {busy ? "Fulfilling…" : "Mark fulfilled"}
                  </button>
                  {err && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-300">
                      <AlertTriangle className="h-3 w-3" /> Shopify write failed
                    </span>
                  )}
                  <span className="ml-auto text-[8px] uppercase tracking-widest text-white/25">Shopify-confirmed write</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tracked.length > 0 && (
        <div className="pt-1">
          <div className="text-[9px] tracking-widest text-white/35 mb-1.5">RECENT TRACKING · SHOPIFY-CONFIRMED</div>
          <div className="space-y-1.5">
            {tracked.slice(0, 6).map((o) => (
              <a key={o.id} href={o.tracking_url || "#"} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                <span className="text-white/70">{o.name} · {o.tracking_number || "Track"}</span>
                <span className="text-accent">Track →</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}