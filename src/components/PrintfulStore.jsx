import { useCallback, useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
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

export default function PrintfulStore({ storeId = "", limit = 200 }) {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Auto-resolve the Printful store ID if one wasn't passed in.
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
      setError(e?.message || "Failed to load store");
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, [storeId, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when the user returns to the tab so dashboard edits flow through.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

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
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> LIVE · {products.length}
          </span>
        )}
      </div>

      {showEmpty && (
        <div className="rounded-3xl border border-white/10 lokin-panel radial-fade p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-black glow-primary">
            <LokinGlyph size={40} className="lokin-spin" />
          </div>
          <div className="mt-3 font-display text-lg font-extrabold tracking-[0.15em] text-primary text-glow">
            STORE OFFLINE
          </div>
          <div className="text-xs text-white/45 mt-1">{error || "No products found."}</div>
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
            <div key={p.id} className="rounded-2xl border border-white/10 lokin-panel p-3">
              <div className="rounded-xl bg-black/50 border border-white/5 overflow-hidden">
                <Image
                  src={p.thumbnail_url}
                  alt={p.name}
                  fittingType="fit"
                  className="aspect-square w-full"
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                  <div className="text-xs text-primary font-bold">{priceLabel(p) || "—"}</div>
                </div>
                <button
                  onClick={() => notify(p.name)}
                  className="shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary active:scale-95 transition-transform"
                >
                  Notify
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}