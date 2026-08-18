import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { LokinWordmark } from "@/components/Brand";
import {
  Loader2,
  RefreshCw,
  Store,
  ShoppingBag,
  Package,
  Activity,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Truck,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

// LOKIN Commerce — Shopify embedded-app entry.
// Public route (no Base44 auth gate) so it renders inside the Shopify Admin iframe.
// Backed by the shopify-embed + shopify-oauth backend functions.

function readParams() {
  const sp = new URLSearchParams(window.location.search);
  const obj = {};
  for (const [k, v] of sp.entries()) obj[k] = v;
  return obj;
}

function money(v, cur = "USD") {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function badge(s = "") {
  const t = String(s || "unfulfilled").replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function ShopifyEmbed() {
  const params = useMemo(() => readParams(), []);
  const shop = params.shop || "";
  const embedded = params.embedded === "1" || Boolean(params.host) || window.self !== window.top;
  const hasCode = Boolean(params.code);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shopInfo, setShopInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [oauthMsg, setOauthMsg] = useState("");

  // OAuth callback: exchange the code, then redirect into Shopify Admin.
  useEffect(() => {
    if (!hasCode) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = await base44.functions.invoke("shopify-oauth", { params });
        const data = res?.data || res;
        if (data?.redirect_url) {
          // Shopify may sandbox embedded frames. Prefer a top-level redirect
          // when allowed, but always fall back to the current frame so the
          // callback can complete instead of leaving a blank iframe.
          try {
            if (window.top && window.top !== window.self) window.top.location.assign(data.redirect_url);
            else window.location.assign(data.redirect_url);
          } catch {
            window.location.assign(data.redirect_url);
          }
          return;
        }
        if (!cancelled) setOauthMsg(data?.error || "OAuth completed but no redirect URL returned.");
      } catch (e) {
        if (!cancelled)
          setOauthMsg(e?.response?.data?.error || e?.data?.error || e?.message || "OAuth exchange failed.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasCode]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [storeRes, healthRes] = await Promise.all([
        base44.functions.invoke("shopify-embed", { action: "storefront", limit: 250, params }),
        base44.functions.invoke("shopify-embed", { action: "health", params }),
      ]);
      const sd = storeRes?.data || storeRes;
      const hd = healthRes?.data || healthRes;
      if (sd?.error) setError(String(sd.error));
      setShopInfo(sd?.shop || null);
      setProducts(sd?.products || []);
      setHealth(hd);
      // Orders are HMAC-gated; surface a friendly notice when unavailable.
      try {
        const or = await base44.functions.invoke("shopify-embed", {
          action: "orders",
          limit: 50,
          status: "any",
          params,
        });
        const od = or?.data || or;
        if (od?.error) {
          setOrdersError(String(od.error));
          setOrders([]);
        } else {
          setOrders(od.orders || []);
          setOrdersError("");
        }
      } catch (e) {
        setOrdersError(e?.response?.data?.error || e?.data?.error || e?.message || "Orders unavailable");
        setOrders([]);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.data?.error || e?.message || "Unable to load store");
    } finally {
      setLoading(false);
    }
  }

  const [health, setHealth] = useState(null);
  useEffect(() => {
    if (!hasCode) load();
  }, [hasCode]);

  // While the OAuth code exchange is in flight.
  if (hasCode) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <LokinWordmark size={26} className="justify-center" />
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <div className="text-sm text-white/60">{busy ? "Connecting your store…" : "Redirecting to Shopify Admin…"}</div>
          {oauthMsg && <div className="text-xs text-red-400 max-w-sm mx-auto">{oauthMsg}</div>}
        </div>
      </div>
    );
  }

  const revenue = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const paid = orders.filter((o) => ["paid", "partially_refunded"].includes(o.financial_status)).length;
  const moving = orders.filter((o) => ["fulfilled", "partial"].includes(o.fulfillment_status)).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <LokinWordmark size={26} />
          <button
            onClick={() => load()}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Not-embedded prompt */}
        {!embedded && (
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 text-sm text-white/75">
            <div className="font-bold text-primary mb-1">Open in Shopify Admin</div>
            <p className="text-xs text-white/55 mb-3">
              LOKIN Commerce runs inside Shopify. Open it from your admin to enable the full embedded experience and order intelligence.
            </p>
            <a
              href={shop ? `https://${shop}/admin` : "https://admin.shopify.com"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-black"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Shopify Admin
            </a>
          </div>
        )}

        {/* Shop card */}
        {shopInfo && (
          <div className="rounded-3xl border border-white/10 lokin-panel p-5">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-primary/70 font-display">
              <Store className="h-3.5 w-3.5" /> STORE
            </div>
            <div className="mt-1 text-xl font-bold font-heading text-white">{shopInfo.name || shop || "LOKIN Store"}</div>
            <div className="text-xs text-white/45">
              {shopInfo.domain || shop} · {shopInfo.country || ""} · {shopInfo.currency || "USD"}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Order intelligence */}
            <section className="rounded-3xl border border-accent/20 lokin-panel p-4 space-y-3">
              <div className="flex items-center gap-2 text-[11px] tracking-[0.24em] text-accent/80 font-display">
                <Activity className="h-3.5 w-3.5" /> ORDER INTELLIGENCE
              </div>
              {ordersError ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/55 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {ordersError}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Metric icon={DollarSign} label="ORDER VALUE" value={money(revenue, shopInfo?.currency || "USD")} />
                    <Metric icon={CheckCircle2} label="PAID" value={`${paid}/${orders.length}`} />
                    <Metric icon={Truck} label="FULFILLED" value={String(moving)} />
                  </div>
                  <div className="space-y-2">
                    {orders.slice(0, 8).map((o) => (
                      <div key={o.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-white">{o.name || `Order ${o.id}`}</div>
                            <div className="text-[10px] text-white/35">
                              {o.created_at ? new Date(o.created_at).toLocaleString() : ""} · {o.items_count || 0} item
                              {o.items_count === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="text-sm font-black text-primary">{money(o.total_price, o.currency)}</div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                            {badge(o.financial_status)}
                          </span>
                          <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent">
                            {badge(o.fulfillment_status)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-xs text-white/40">
                        No orders yet.
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Catalog */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-white/45 font-display">
                <ShoppingBag className="h-3.5 w-3.5" /> CATALOG · {products.length} PRODUCTS
              </div>
              <div className="grid grid-cols-2 gap-3">
                {products.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-white/10 lokin-panel overflow-hidden">
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt={p.title} className="h-32 w-full object-cover bg-black/40" />
                    ) : (
                      <div className="h-32 w-full flex items-center justify-center bg-black/40">
                        <Package className="h-8 w-8 text-white/20" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="text-sm font-semibold text-white line-clamp-2">{p.title}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">
                        {p.vendor || ""} · {p.status}
                      </div>
                      <div className="mt-1 text-sm font-bold text-primary">
                        {p.min_price
                          ? `${money(p.min_price, p.currency)} – ${money(p.max_price, p.currency)}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="col-span-2 rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-xs text-white/40">
                    No products published.
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-2 pb-4">
          LOKIN COMMERCE · LOCK IN. LEVEL UP.
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
      <Icon className="h-4 w-4 text-accent" />
      <div className="mt-2 text-[9px] tracking-[.14em] text-white/30">{label}</div>
      <div className="mt-0.5 text-sm font-black text-white">{value}</div>
    </div>
  );
}