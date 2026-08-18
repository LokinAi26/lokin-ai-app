import { useMemo, useState } from "react";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { money } from "./format";

export default function CustomerView({ orders, currency }) {
  const [sel, setSel] = useState(null);
  const customers = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      const c = o.customer;
      if (!c) return;
      const k = c.email || c.id;
      if (!k) return;
      if (!m[k]) m[k] = { name: c.name || k, email: c.email, orders: 0, spend: 0, list: [] };
      m[k].orders += 1;
      m[k].spend += Number(o.total_price || 0);
      m[k].list.push(o);
    });
    return Object.values(m).sort((a, b) => b.spend - a.spend);
  }, [orders]);

  const top = customers.slice(0, 10);

  return (
    <section className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-white/55 font-display">
        <Users className="h-3.5 w-3.5" /> CUSTOMERS · {customers.length} TOTAL
      </div>
      <div className="space-y-2">
        {top.map((c, i) => {
          const open = sel === c.email;
          return (
            <div key={c.email || i} className="rounded-2xl border border-white/10 bg-black/35 overflow-hidden">
              <button onClick={() => setSel(open ? null : c.email)} className="w-full p-3 text-left flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    #{i + 1} {c.name} {open ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
                  </div>
                  <div className="text-[10px] text-white/35">{c.email || "—"} · {c.orders} order{c.orders === 1 ? "" : "s"}</div>
                </div>
                <div className="text-sm font-black text-primary">{money(c.spend, currency)}</div>
              </button>
              {open && (
                <div className="border-t border-white/10 p-3 space-y-1.5">
                  {c.list
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((o) => (
                      <div key={o.id} className="flex items-center justify-between text-xs">
                        <span className="text-white/60">{o.name} · {new Date(o.created_at).toLocaleDateString()}</span>
                        <span className="text-white/80">{money(o.total_price, o.currency || currency)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
        {top.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-xs text-white/40">No customers yet.</div>
        )}
      </div>
    </section>
  );
}