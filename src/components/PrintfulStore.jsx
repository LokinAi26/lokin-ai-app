import { useCallback, useEffect, useState } from "react";
import { ShoppingBag, RefreshCw, X, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { LokinGlyph } from "@/components/Brand";
import { useToast } from "@/components/ui/use-toast";

function priceLabel(p) {
  if (!p.min_price) return "";
  const sym = (p.currency || "USD") === "USD" ? "$" : "";
  if (!p.max_price || p.min_price === p.max_price) return `${sym}${p.min_price}`;
  return `${sym}${p.min_price}–${sym}${p.max_price}`;
}

function variantPrice(v) {
  if (!v?.retail_price) return "—";
  const sym = (v.currency || "USD") === "USD" ? "$" : "";
  return `${sym}${Number(v.retail_price).toFixed(2)}`;
}

export default function PrintfulStore({ storeId = "", limit = 200 }) {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      let sid = storeId;
      if (!sid) {
        const sres = await base44.functions.invoke("printful-catalog", { action: "stores" });
        sid = sres.data?.stores?.[0]?.id ? String(sres.data.stores[0].id) : "";
      }
      if (!sid) {
        setLive(false);
        setError("No Printful store connected to your account yet.");
        setProducts([]);
        return;
      }
      const res = await base44.functions.invoke("printful-catalog", {
        action: "catalog",
        storeId: sid,
        limit,
      });
      setProducts(res.data?.products || []);
      setLive(true);
      setError(null);
    } catch (e) {
      const detail = e?.response?.data?.error || e?.data?.error || e?.message || "Failed to load store";
      const friendly = /status code 400/i.test(String(detail))
        ? "Printful rejected the catalog request. Re-test Commerce Connections; the token may need sync_products/read access or the store context may need to be refreshed."
        : String(detail);
      setError(friendly);
      setLive(false);
    }
  }, [storeId, limit]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    toast({ title: "Storefront synced", description: "Pulled the latest from Printful." });
  }

  function notify(name) {
    toast({ title: "Added to waitlist", description: `We'll ping you when ${name} drops.` });
  }

  const showSkeleton = loading && products.length === 0 && !error;
  const showEmpty = !loading && (error || products.length === 0);
  const showGrid = products.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ShoppingBag className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold text-white/80">The Vault</div>
        {live && !error && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> LIVE · {products.length}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={refreshing}
          aria-label="Re-sync Printful store"
          className="ml-auto rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/70 active:scale-95 transition-transform disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {showEmpty && (
        <div className="rounded-3xl border border-white/10 lokin-panel radial-fade p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-black glow-primary">
            <LokinGlyph size={40} className="lokin-spin" />
          </div>
          <div className="mt-3 font-display text-lg font-extrabold tracking-[0.15em] text-primary text-glow">
            NO PRODUCTS YET
          </div>
          <div className="text-xs text-white/45 mt-1 max-w-[30ch] mx-auto">
            {error ? error : "Add your LOKIN items as Sync Products in Printful — they'll appear here automatically."}
          </div>
          <a
            href="https://www.printful.com/dashboard/store/18600767/products"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary active:scale-95 transition-transform"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Add products in Printful
          </a>
        </div>
      )}

      {showSkeleton && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 lokin-panel p-3">
              <div className="aspect-square rounded-xl bg-white/5 animate-pulse" />
              <div className="mt-2 h-3 w-2/3 rounded bg-white/5 animate-pulse" />
              <div className="mt-1 h-3 w-1/3 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {showGrid && (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="group text-left rounded-2xl border border-white/10 lokin-panel p-2.5 active:scale-[0.98] active:border-primary/40 active:glow-primary transition-all"
            >
              <div className="relative rounded-xl bg-black/50 border border-white/5 overflow-hidden">
                <Image src={p.thumbnail_url} alt={p.name} fittingType="fit" className="aspect-square w-full" />
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent" />
                <span className="absolute top-1.5 right-1.5 rounded-full bg-black/70 border border-primary/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-primary backdrop-blur">
                  {p.variants?.length || 0}
                </span>
              </div>
              <div className="px-1 pt-2 pb-0.5">
                <div className="text-sm font-semibold text-white truncate leading-tight">{p.name}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="rounded-md bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-xs font-bold text-primary text-glow">
                    {priceLabel(p) || "—"}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-white/30 group-active:text-primary">View</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md rounded-3xl border border-primary/25 lokin-panel radial-fade max-h-[85vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 glass border-b border-white/8">
              <div className="text-sm font-bold text-white truncate pr-2">{selected.name}</div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="rounded-lg p-1 text-white/60 active:scale-90 transition-transform">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 rounded-xl bg-black/50 border border-white/5 overflow-hidden">
                  <Image src={selected.thumbnail_url} alt={selected.name} fittingType="fit" className="h-20 w-20" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-display text-primary text-glow">{priceLabel(selected) || "—"}</div>
                  <div className="text-xs text-white/45">{selected.variants?.length || 0} variants · {selected.currency || "USD"}</div>
                </div>
              </div>

              <div className="text-[11px] tracking-widest text-white/40 font-display">VARIANTS & PRICING</div>
              <div className="space-y-2">
                {(selected.variants || []).map((v) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/40 p-2">
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-black/60 border border-white/5 overflow-hidden">
                      {v.thumbnail_url ? (
                        <Image src={v.thumbnail_url} alt={v.name} fittingType="fit" className="h-12 w-12" />
                      ) : (
                        <div className="h-12 w-12 flex items-center justify-center"><LokinGlyph size={22} /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{v.name}</div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {v.in_stock ? (
                          <span className="inline-flex items-center gap-1 text-primary"><Check className="h-3 w-3" /> In stock</span>
                        ) : (
                          <span className="text-white/40">Unavailable</span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-primary shrink-0">{variantPrice(v)}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => notify(selected.name)}
                className="w-full rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary active:scale-[0.99] transition-transform"
              >
                Notify me when available
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}