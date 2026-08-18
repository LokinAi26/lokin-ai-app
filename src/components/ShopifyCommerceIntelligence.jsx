import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import CommerceIntelligenceScore from "./commerce/CommerceIntelligenceScore";
import OrderCharts from "./commerce/OrderCharts";
import AIPredictions from "./commerce/AIPredictions";
import OrderExplorer from "./commerce/OrderExplorer";
import FulfillmentPanel from "./commerce/FulfillmentPanel";
import CustomerView from "./commerce/CustomerView";
import InventoryHealth from "./commerce/InventoryHealth";

export default function ShopifyCommerceIntelligence({ invokeShopify, products, currency, bridge, ready }) {
  const [orders, setOrders] = useState([]);
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!ready) return;
    setLoading(true);
    setError("");
    bridge?.setLoading?.(true);
    try {
      const [od, id] = await Promise.all([
        invokeShopify("orders", { limit: 250, status: "any" }, true),
        invokeShopify("intelligence", { limit: 250 }, true),
      ]);
      setOrders(od.orders || []);
      setIntel(id);
    } catch (e) {
      const msg = e?.message || "Commerce intelligence unavailable";
      setError(msg);
      bridge?.toast?.(msg, true);
    } finally {
      setLoading(false);
      bridge?.setLoading?.(false);
    }
  }

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) {
    return (
      <div className="rounded-3xl border border-white/10 lokin-panel p-5 text-center text-xs text-white/40">
        Open in Shopify Admin to unlock commerce intelligence.
      </div>
    );
  }
  if (loading && !orders.length) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] tracking-[0.22em] text-white/45 font-display">COMMERCE INTELLIGENCE</div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-white/70 disabled:opacity-50 flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-3 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      <CommerceIntelligenceScore score={intel?.predictions?.commerce_intelligence_score} />
      <OrderCharts orders={orders} currency={currency} />
      <AIPredictions predictions={intel?.predictions} currency={currency} />
      <OrderExplorer orders={orders} currency={currency} />
      <FulfillmentPanel orders={orders} currency={currency} />
      <CustomerView orders={orders} currency={currency} />
      <InventoryHealth products={products} currency={currency} />
    </div>
  );
}