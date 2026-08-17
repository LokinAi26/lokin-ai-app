import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, PackageCheck, RefreshCw, ShoppingBag, Truck, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";

function tone(status = "") {
  const s = String(status).toLowerCase();
  if (["fulfilled", "shipped", "delivered"].some((x) => s.includes(x))) return "text-primary border-primary/30 bg-primary/10";
  if (["cancel", "failed", "error"].some((x) => s.includes(x))) return "text-red-300 border-red-500/30 bg-red-500/10";
  return "text-amber-200 border-amber-500/30 bg-amber-500/10";
}

function money(value, currency = "USD") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n); }
  catch { return `$${n.toFixed(2)}`; }
}

export default function CommerceOps() {
  const [shopify, setShopify] = useState([]);
  const [printful, setPrintful] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, p] = await Promise.allSettled([
        base44.functions.invoke("shopify-catalog", { action: "orders", limit: 20, status: "any" }),
        base44.functions.invoke("printful-catalog", { action: "orders", limit: 20 }),
      ]);
      if (s.status === "fulfilled") setShopify(s.value?.data?.orders || []);
      if (p.status === "fulfilled") setPrintful(p.value?.data?.orders || []);
      if (s.status === "rejected" && p.status === "rejected") {
        throw new Error("Order telemetry is unavailable. Verify Shopify/Printful order-read permissions.");
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Commerce telemetry failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const paid = shopify.filter((o) => ["paid", "authorized", "partially_paid"].includes(String(o.financial_status || "").toLowerCase())).length;
    const fulfilled = shopify.filter((o) => String(o.fulfillment_status || "").toLowerCase() === "fulfilled").length;
    const shipped = printful.filter((o) => (o.tracking || []).length > 0 || String(o.fulfillment_status || "").toLowerCase().includes("fulfilled")).length;
    return { orders: shopify.length, paid, fulfilled, shipped };
  }, [shopify, printful]);

  const latest = shopify.slice(0, 5);

  return (
    <section className="rounded-3xl border border-primary/20 lokin-panel overflow-hidden">
      <div className="p-4 border-b border-white/8 bg-gradient-to-r from-primary/[0.07] to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] tracking-[0.24em] text-primary/70 font-display">COMMERCE INTELLIGENCE</div>
            <div className="mt-1 text-lg font-bold text-white flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Order & Fulfillment Mesh</div>
            <div className="text-xs text-white/45 mt-1">Shopify payment signal → Printful fulfillment → tracking telemetry</div>
          </div>
          <button onClick={load} disabled={loading} className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary disabled:opacity-50" aria-label="Refresh commerce intelligence">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <Metric icon={ShoppingBag} label="Orders" value={metrics.orders} />
          <Metric icon={CheckCircle2} label="Paid" value={metrics.paid} />
          <Metric icon={PackageCheck} label="Fulfilled" value={metrics.fulfilled} />
          <Metric icon={Truck} label="Tracked" value={metrics.shipped} />
        </div>

        {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

        <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
            <span className="text-[10px] tracking-[0.18em] text-white/40 font-display">RECENT SHOPIFY ORDERS</span>
            <span className="text-[10px] text-primary/70">least-privilege admin telemetry</span>
          </div>
          {latest.length === 0 ? (
            <div className="p-4 text-xs text-white/40 text-center">{loading ? "Loading commerce telemetry…" : "No recent orders yet."}</div>
          ) : latest.map((o) => (
            <div key={o.id} className="px-3 py-3 border-t border-white/6 first:border-t-0 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl border border-primary/20 bg-primary/[0.06] grid place-items-center"><ShoppingBag className="h-4 w-4 text-primary" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="text-sm font-bold text-white">{o.name || `#${o.id}`}</span><span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${tone(o.fulfillment_status || o.financial_status)}`}>{String(o.fulfillment_status || o.financial_status || "processing").toUpperCase()}</span></div>
                <div className="text-[11px] text-white/40 truncate">{o.items_count || 0} item{o.items_count === 1 ? "" : "s"} · {o.financial_status || "payment pending"}</div>
              </div>
              <div className="text-sm font-bold text-primary">{money(o.total_price, o.currency || "USD")}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/8 bg-black/30 p-3 flex items-start gap-2">
          <Clock3 className="h-4 w-4 text-accent mt-0.5" />
          <div className="text-[11px] leading-relaxed text-white/50"><span className="text-white/75 font-semibold">Fail-closed commerce rule:</span> LOKIN never marks an order fulfilled from checkout alone. Fulfillment/tracking must come from the fulfillment provider signal.</div>
        </div>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-xl border border-white/10 bg-black/35 p-2.5 text-center"><Icon className="h-4 w-4 text-primary mx-auto" /><div className="mt-1 text-lg font-black text-white">{value}</div><div className="text-[9px] tracking-wider text-white/35 uppercase">{label}</div></div>;
}
