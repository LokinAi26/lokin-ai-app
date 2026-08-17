import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Navigation, MapPin, Clock, ChevronRight, Package, RefreshCw, ScanLine } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CATEGORY_LABELS } from "@/lib/deliveryLabels";
import PullToRefresh from "@/components/PullToRefresh";

const SHOP_CATEGORIES = ["grocery_shop_deliver", "grocery_pickup", "retail"];

// Distribute stops along a wavy neon route inside the map card.
function routePoints(n) {
  const safe = Math.max(1, n);
  const pts = [];
  for (let i = 0; i < safe; i++) {
    const t = safe === 1 ? 0.5 : i / (safe - 1);
    const x = 28 + 264 * t;
    const y = 132 - 96 * t + 26 * Math.sin(t * Math.PI * 1.6);
    pts.push([x, y]);
  }
  return pts;
}

export default function ShopDeliver() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const all = await base44.entities.Offer.filter({}, "sequence");
      const filtered = all
        .filter((o) => SHOP_CATEGORIES.includes(o.category))
        .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999));
      setOrders(filtered);
      setActive(0);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const stops = orders.length;
    const miles = orders.reduce((s, o) => s + (o.miles || 0), 0);
    const mins = orders.reduce((s, o) => s + (o.est_minutes || 0), 0);
    const pay = orders.reduce((s, o) => s + (o.payout || 0) + (o.tip || 0), 0);
    return { stops, miles, mins, pay };
  }, [orders]);

  const current = orders[active];
  const pts = routePoints(orders.length);
  const pathD = pts.length ? pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") : "";

  function openInMaps() {
    if (orders.length === 0) return;
    const origin = orders[0].pickup_address || orders[0].merchant || "";
    const dest = orders[orders.length - 1].dropoff_address || orders[orders.length - 1].merchant || "";
    const waypoints = orders.slice(1, -1).map((o) => encodeURIComponent(o.dropoff_address || o.merchant)).join("|");
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}${waypoints ? `&waypoints=${waypoints}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold font-heading metal-text">Shop & Deliver</h1>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 active:scale-95">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Rescan
          </button>
        </div>
        <p className="text-sm text-white/45 -mt-2">Live route map for your shop & deliver orders.</p>

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-2">
          <Mini label="Stops" value={totals.stops} />
          <Mini label="Miles" value={totals.miles.toFixed(0)} />
          <Mini label="Est. min" value={totals.mins} />
          <Mini label="Est. pay" value={`$${totals.pay.toFixed(0)}`} accent />
        </div>

        {/* Dark route map */}
        {orders.length > 0 ? (
          <div className="rounded-3xl border border-white/10 overflow-hidden lokin-panel">
            <div className="relative h-60 bg-black">
              <div className="absolute inset-0 brand-grid opacity-40" />
              <svg viewBox="0 0 320 160" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <path d={pathD} stroke="hsl(80 100% 50%)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px hsl(80 100% 50% / 0.9))" }} />
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={p[0]} cy={p[1]} r={i === active ? 7 : 5} fill={i === 0 ? "#06D9F9" : "hsl(80 100% 50%)"} stroke="#000" strokeWidth="2" style={{ filter: i === active ? "drop-shadow(0 0 8px hsl(80 100% 50% / 0.9))" : "none" }} />
                    <text x={p[0]} y={p[1] + 1.5} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#000">{i + 1}</text>
                  </g>
                ))}
              </svg>
              <div className="absolute top-2 left-3 rounded-full bg-black/60 border border-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/70">
                Stop {active + 1}/{orders.length}
              </div>
            </div>
            <button onClick={openInMaps} className="w-full flex items-center justify-center gap-2 border-t border-white/10 bg-primary/10 py-3 text-sm font-bold text-primary active:scale-[0.99] transition-transform">
              <Navigation className="h-4 w-4" /> Open in Maps
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 lokin-panel p-8 text-center">
            <Package className="h-8 w-8 mx-auto text-white/30 mb-2" />
            <div className="text-sm text-white/55">{loading ? "Scanning for shop & deliver orders…" : "No shop & deliver orders yet."}</div>
            <div className="text-xs text-white/35 mt-1">Add offers with a grocery/retail category to map them here.</div>
          </div>
        )}

        {/* Active stop detail */}
        {current && (
          <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.18em] text-primary/70">Active Stop {active + 1}</div>
              <div className="text-sm font-bold text-primary">${((current.payout || 0) + (current.tip || 0)).toFixed(2)}</div>
            </div>
            <div className="mt-2 font-semibold text-white">{current.merchant}</div>
            <div className="text-xs text-white/45">{current.customer_name ? `Customer ${current.customer_name}` : CATEGORY_LABELS[current.category] || current.category}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{current.miles || 0} mi</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-primary" />{current.est_minutes || 0} min</span>
              <span className="flex items-center gap-1"><Package className="h-3 w-3 text-primary" />{current.items_count || 1} items</span>
            </div>
            {current.dropoff_address && (
              <div className="mt-2 text-xs truncate text-white/45"><span className="text-primary">→ </span>{current.dropoff_address}</div>
            )}
            <Link to="/locator" className="mt-3 flex items-center justify-between rounded-2xl border border-primary/25 bg-black/30 px-3 py-2.5 active:scale-[0.99] transition-transform">
              <span className="flex items-center gap-2 text-xs font-semibold text-primary"><ScanLine className="h-4 w-4"/>Open Smart Shop Item Locator</span>
              <ChevronRight className="h-4 w-4 text-primary/60"/>
            </Link>
          </div>
        )}

        {/* Order list */}
        {orders.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white/80">Delivery Order</div>
            {orders.map((o, i) => (
              <button key={o.id} onClick={() => setActive(i)}
                className={`w-full rounded-2xl border p-3.5 text-left transition-colors ${i === active ? "border-primary/40 bg-primary/[0.06]" : "border-white/10 lokin-panel"}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === active ? "bg-primary text-primary-foreground glow-primary" : "bg-white/10 text-white/70"}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm truncate text-white">{o.merchant}</div>
                      <div className="text-sm font-bold text-primary">${((o.payout || 0) + (o.tip || 0)).toFixed(2)}</div>
                    </div>
                    <div className="text-xs text-white/45">{o.customer_name ? `Customer ${o.customer_name}` : CATEGORY_LABELS[o.category] || o.category}</div>
                    <div className="mt-1 flex gap-x-3 text-xs text-white/55">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{o.miles || 0}mi</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-primary" />{o.est_minutes || 0}m</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

function Mini({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel p-3 text-center">
      <div className={`text-lg font-bold font-display ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</div>
      <div className="text-[10px] text-white/40 uppercase tracking-wide">{label}</div>
    </div>
  );
}