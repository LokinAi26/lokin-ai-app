import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { money, badge } from "./format";

export default function OrderExplorer({ orders, currency }) {
  const [q, setQ] = useState("");
  const [fin, setFin] = useState("");
  const [ful, setFul] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    let list = orders.slice();
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (o) =>
          String(o.name || "").toLowerCase().includes(s) ||
          String(o.customer?.email || "").toLowerCase().includes(s) ||
          String(o.customer?.name || "").toLowerCase().includes(s)
      );
    }
    if (fin) list = list.filter((o) => o.financial_status === fin);
    if (ful) {
      if (ful === "unfulfilled") list = list.filter((o) => !o.fulfillment_status || o.fulfillment_status === "null");
      else list = list.filter((o) => o.fulfillment_status === ful);
    }
    list.sort((a, b) =>
      sort === "value_desc"
        ? Number(b.total_price) - Number(a.total_price)
        : sort === "value_asc"
        ? Number(a.total_price) - Number(b.total_price)
        : sort === "date_asc"
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at)
    );
    return list;
  }, [orders, q, fin, ful, sort]);

  return (
    <section className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-white/55 font-display">
        <Search className="h-3.5 w-3.5" /> ORDERS · {filtered.length} MATCHED
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="h-3.5 w-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name/email…"
            className="w-full rounded-xl bg-black/50 border border-white/10 pl-8 pr-3 py-2 text-xs text-white"
          />
        </div>
        <select value={fin} onChange={(e) => setFin(e.target.value)} className="rounded-xl bg-black/50 border border-white/10 px-2 py-2 text-xs text-white">
          <option value="">All payments</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partially paid</option>
          <option value="refunded">Refunded</option>
          <option value="voided">Voided</option>
        </select>
        <select value={ful} onChange={(e) => setFul(e.target.value)} className="rounded-xl bg-black/50 border border-white/10 px-2 py-2 text-xs text-white">
          <option value="">All fulfillment</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="partial">Partial</option>
          <option value="unfulfilled">Unfulfilled</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl bg-black/50 border border-white/10 px-2 py-2 text-xs text-white">
          <option value="date_desc">Newest</option>
          <option value="date_asc">Oldest</option>
          <option value="value_desc">Value ↓</option>
          <option value="value_asc">Value ↑</option>
        </select>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
        {filtered.map((o) => (
          <div key={o.id} className="rounded-2xl border border-white/10 bg-black/35 overflow-hidden">
            <button onClick={() => setOpenId(openId === o.id ? null : o.id)} className="w-full p-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    {o.name || `Order ${o.id}`} {openId === o.id ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
                  </div>
                  <div className="text-[10px] text-white/35">
                    {o.created_at ? new Date(o.created_at).toLocaleString() : ""} · {o.customer?.email || "No customer"} · {o.items_count} item{o.items_count === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-sm font-black text-primary">{money(o.total_price, o.currency || currency)}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">{badge(o.financial_status)}</span>
                {o.test && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">TEST · excluded from production metrics</span>}
                <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent">{badge(o.fulfillment_status)}</span>
                {o.refunds > 0 && (
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-300">{o.refunds} refund{o.refunds > 1 ? "s" : ""}</span>
                )}
              </div>
            </button>
            {openId === o.id && (
              <div className="border-t border-white/10 p-3 space-y-2">
                {(o.line_items || []).map((it, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <div className="text-white truncate">{it.title}</div>
                      <div className="text-[9px] text-white/30">{it.sku || "—"} · qty {it.quantity}</div>
                    </div>
                    <div className="text-white/70">{money(Number(it.price || 0) * Number(it.quantity || 1), o.currency || currency)}</div>
                  </div>
                ))}
                {o.tracking_url && (
                  <a href={o.tracking_url} target="_blank" rel="noreferrer" className="block text-[10px] text-accent underline">
                    Track shipment {o.tracking_number || ""}
                  </a>
                )}
                <div className="flex justify-between text-[10px] text-white/40 pt-1 border-t border-white/5">
                  <span>Subtotal {money(o.subtotal_price, o.currency || currency)}</span>
                  <span>Tax {money(o.total_tax, o.currency || currency)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-xs text-white/40">No orders match.</div>
        )}
      </div>
    </section>
  );
}