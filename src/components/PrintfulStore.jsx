import { useCallback, useEffect, useState } from "react";
import { ShoppingBag, ShoppingCart, RefreshCw, X, Check, Shirt } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { LokinGlyph } from "@/components/Brand";
import { useToast } from "@/components/ui/use-toast";

function priceLabel(p) {
  if (p.is_template) return "";
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

// Map a Printful product template (the modern "published" product) to a display card.
function templateToCard(t) {
  return {
    id: `tpl-${t.id}`,
    name: t.title || "Product Template",
    thumbnail_url: t.mockup_file_url || null,
    variants: (t.available_variant_ids || []).map((vid) => ({ id: vid })),
    is_template: true,
    colors: t.colors || [],
    sizes: t.sizes || [],
    placements: t.placements || [],
    created_at: t.created_at || null,
    is_new: t.created_at ? Date.now() / 1000 - t.created_at < 14 * 24 * 3600 : false,
  };
}

function normalizeName(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function shopifyToCard(p, domain) {
  const variants = (p.variants || []).map((v) => ({
    ...v,
    id: v.id,
    name: v.title,
    retail_price: v.price,
    currency: p.currency || "USD",
    in_stock: v.available == null ? true : Number(v.available) !== 0,
    thumbnail_url: p.thumbnail_url,
  }));
  return {
    id: `shopify-${p.id}`,
    external_id: String(p.id),
    name: p.title,
    handle: p.handle,
    thumbnail_url: p.thumbnail_url,
    variants,
    min_price: p.min_price,
    max_price: p.max_price,
    currency: p.currency || "USD",
    is_shopify: true,
    status: p.status,
    checkout_url: domain && p.handle ? `https://${domain}/products/${p.handle}` : null,
  };
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
      // Resolve the list of stores to scan. Prefer an explicit storeId, else scan every store.
      let stores = [];
      if (storeId) {
        stores = [{ id: storeId, type: "native" }];
      } else {
        const sres = await base44.functions.invoke("printful-catalog", { action: "stores" });
        stores = sres.data?.stores || [];
      }
      if (!stores.length) {
        setLive(false);
        setError("No Printful store connected to your account yet.");
        setProducts([]);
        return;
      }

      const syncProducts = [];
      const templates = [];
      let shopifyProducts = [];
      let shopifyDomain = "";
      for (const s of stores) {
        const sid = String(s.id);
        // Sync-product catalog only works on Manual Order / API (native) platform stores.
        if (s.type !== "shopify") {
          try {
            const res = await base44.functions.invoke("printful-catalog", { action: "catalog", storeId: sid, limit });
            syncProducts.push(...(res.data?.products || []));
          } catch {}
        }
        // Product templates (Printful's modern published products) work across stores.
        try {
          const tres = await base44.functions.invoke("printful-tools", { action: "templates", storeId: sid, limit });
          const items = tres.data?.templates?.items || [];
          templates.push(...items.map(templateToCard));
        } catch {}
      }

      // Shopify is the customer-facing checkout surface. Pull its live catalog too,
      // then merge it with Printful so synced products become immediately buyable in-app.
      try {
        const [shopRes, catRes] = await Promise.all([
          base44.functions.invoke("shopify-catalog", { action: "shop" }),
          base44.functions.invoke("shopify-catalog", { action: "catalog", limit: 250 }),
        ]);
        shopifyDomain = shopRes.data?.shop?.domain || "";
        shopifyProducts = (catRes.data?.products || [])
          .filter((p) => !p.status || p.status === "active")
          .map((p) => shopifyToCard(p, shopifyDomain));
      } catch {}

      // Customer-facing Shopify products take precedence over matching Printful
      // templates/sync records. De-dupe by normalized title so one sellable item
      // appears once even when it exists in both systems.
      const seen = new Set();
      const all = [...shopifyProducts, ...templates, ...syncProducts].filter((p) => {
        const key = normalizeName(p.name) || String(p.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setProducts(all);
      setLive(all.length > 0);
      setError(all.length === 0 ? "No products or templates found in your Printful stores yet." : null);
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
            {error ? error : "Publish a product in Printful — it'll appear here automatically."}
          </div>
          <a
            href="https://www.printful.com/dashboard/products"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary active:scale-95 transition-transform"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Publish in Printful
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
                {p.thumbnail_url ? (
                  <Image src={p.thumbnail_url} alt={p.name} fittingType="fit" className="aspect-square w-full" />
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center">
                    <LokinGlyph size={44} />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent" />
                {p.is_template && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/40 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-accent backdrop-blur">
                    <Shirt className="h-2.5 w-2.5" /> POD
                  </span>
                )}
                {p.is_new && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-black tracking-wider text-black">NEW</span>
                )}
                <span className="absolute top-1.5 right-1.5 rounded-full bg-black/70 border border-primary/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-primary backdrop-blur">
                  {p.variants?.length || 0}
                </span>
              </div>
              <div className="px-1 pt-2 pb-0.5">
                <div className="text-sm font-semibold text-white truncate leading-tight">{p.name}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`rounded-md border px-1.5 py-0.5 text-xs font-bold ${p.is_template ? "border-accent/40 bg-accent/10 text-accent" : "border-primary/30 bg-primary/10 text-primary text-glow"}`}>
                    {p.is_template ? "TEMPLATE" : (priceLabel(p) || "—")}
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
                  {selected.thumbnail_url ? (
                    <Image src={selected.thumbnail_url} alt={selected.name} fittingType="fit" className="h-20 w-20" />
                  ) : (
                    <div className="h-20 w-20 flex items-center justify-center"><LokinGlyph size={28} /></div>
                  )}
                </div>
                <div>
                  {selected.is_template ? (
                    <>
                      <div className="text-sm font-bold font-display text-accent text-glow-cyan tracking-wide">PRODUCT TEMPLATE</div>
                      <div className="text-xs text-white/45 mt-0.5">Print-on-demand · {selected.variants?.length || 0} variants</div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold font-display text-primary text-glow">{priceLabel(selected) || "—"}</div>
                      <div className="text-xs text-white/45">{selected.variants?.length || 0} variants · {selected.currency || "USD"}</div>
                    </>
                  )}
                </div>
              </div>

              {selected.is_template ? (
                <div className="space-y-2">
                  <div className="text-[11px] tracking-widest text-white/40 font-display">COLORS</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.colors || []).length === 0 && <span className="text-xs text-white/40">—</span>}
                    {(selected.colors || []).map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white/80">
                        {c.color_codes?.[0] && <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: c.color_codes[0] }} />}
                        {c.color_name}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] tracking-widest text-white/40 font-display pt-1">SIZES</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.sizes || []).length === 0 && <span className="text-xs text-white/40">—</span>}
                    {(selected.sizes || []).map((sz, i) => (
                      <span key={i} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">{sz}</span>
                    ))}
                  </div>
                  {(selected.placements || []).length > 0 && (
                    <>
                      <div className="text-[11px] tracking-widest text-white/40 font-display pt-1">PRINT PLACEMENTS</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.placements.map((pl, i) => (
                          <span key={i} className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white/70">
                            {pl.display_name || pl.placement}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="rounded-xl border border-white/8 bg-black/40 p-3 text-[11px] leading-relaxed text-white/50">
                    This is a published Printful product template. Set a retail price & sync it to a storefront in Printful to enable checkout.
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}

              {selected.is_template ? (
                <a
                  href="https://www.printful.com/dashboard/products"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-xl border border-accent/40 bg-accent/10 py-3 text-sm font-bold text-accent text-center active:scale-[0.99] transition-transform inline-flex items-center justify-center gap-2"
                >
                  <Shirt className="h-4 w-4" /> Set price & sync in Printful
                </a>
              ) : (
                <button
                  onClick={() => notify(selected.name)}
                  className="w-full rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary active:scale-[0.99] transition-transform"
                >
                  Notify me when available
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}