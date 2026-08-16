import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Package, RefreshCw, AlertTriangle, CheckCircle2, PackageX, Boxes, ChevronDown,
} from "lucide-react";
import { guardedInvoke } from "@/lib/creditGuardian";

// Printify inventory monitor.
//
// Printify is print-on-demand, so it doesn't expose stock quantities — the
// meaningful availability signal is whether each product's variants are
// `is_enabled`. A disabled variant means that size/color can't be ordered.
// This monitor reads the live Printify catalog and flags branded products
// whose available (enabled) variant count has fallen below your threshold,
// so you can reactivate or restock the affected options before they block a sale.

const THRESHOLD_KEY = "lokin_inv_threshold";
const DEFAULT_THRESHOLD = 3;

function loadThreshold() {
  const n = parseInt(localStorage.getItem(THRESHOLD_KEY) || "", 10);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_THRESHOLD;
}

export default function InventoryMonitor() {
  const [shopId, setShopId] = useState("");
  const [products, setProducts] = useState([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(loadThreshold);
  const [openLow, setOpenLow] = useState(true);

  async function load(force = false) {
    setLoading(true);
    setError("");
    try {
      const shopsRes = await guardedInvoke(base44, "printify-catalog", { action: "shops" }, { force, userInitiated: force });
      const shopsData = shopsRes?.data || shopsRes;
      const shops = shopsData?.shops || [];
      const sid = String(shops[0]?.id || "");
      setShopId(sid);
      setDemo(Boolean(shopsData?.demo));
      if (!sid) {
        setProducts([]);
        setError("No Printify shop found on your account.");
        return;
      }
      const catRes = await guardedInvoke(base44, "printify-catalog", { action: "catalog", shop_id: sid }, { force, userInitiated: force });
      const catData = catRes?.data || catRes;
      setDemo(Boolean(catData?.demo));
      setProducts(Array.isArray(catData?.products) ? catData.products : []);
    } catch (e) {
      setError(e?.message || "Could not load Printify catalog.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function changeThreshold(v) {
    const n = Math.max(1, parseInt(v, 10) || 1);
    setThreshold(n);
    localStorage.setItem(THRESHOLD_KEY, String(n));
  }

  // Score each product's availability.
  const scored = products.map((p) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const total = variants.length;
    const enabled = variants.filter((v) => v.is_enabled).length;
    let status = "ok";
    if (enabled === 0) status = "out";
    else if (enabled < threshold) status = "low";
    return { ...p, total, enabled, status };
  });
  const flagged = scored.filter((p) => p.status !== "ok");
  const outCount = flagged.filter((p) => p.status === "out").length;
  const lowCount = flagged.filter((p) => p.status === "low").length;
  const healthy = scored.filter((p) => p.status === "ok");

  return (
    <div className="rounded-3xl border border-primary/20 lokin-panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.24em] text-primary/70 font-display">INVENTORY MONITOR</div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" /> Printify Stock Watch
          </div>
          <div className="text-xs text-white/45 mt-1">
            Tracks available variants across your branded items
            {demo && <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">demo data</span>}
          </div>
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary disabled:opacity-50 select-none">
          <span className="flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> {loading ? "Scanning…" : "Rescan"}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <label htmlFor="inv-thr" className="text-[11px] text-white/55">Alert when available variants fall below</label>
        <input
          id="inv-thr"
          type="number"
          min={1}
          value={threshold}
          onChange={(e) => changeThreshold(e.target.value)}
          className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-primary font-bold text-center"
        />
        <span className="text-[11px] text-white/40">per product</span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {flagged.length > 0 ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-red-300">
              {outCount > 0 && `${outCount} unavailable`}
              {outCount > 0 && lowCount > 0 && " · "}
              {lowCount > 0 && `${lowCount} running low`}
            </div>
            <div className="text-red-300/70 mt-0.5">
              Some branded items have limited or no enabled variants — re-enable them in Printify.
            </div>
          </div>
        </div>
      ) : !loading && !error && products.length > 0 ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-3 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <div className="text-xs text-primary/90 font-semibold">All {products.length} branded items are fully stocked.</div>
        </div>
      ) : null}

      {/* Flagged items */}
      {flagged.length > 0 && (
        <div className="space-y-2">
          {flagged.map((p) => (
            <ProductRow key={p.id} p={p} />
          ))}
        </div>
      )}

      {/* Healthy items, collapsible */}
      {healthy.length > 0 && (
        <div className="border-t border-white/8 pt-2">
          <button
            onClick={() => setOpenLow((o) => !o)}
            className="flex w-full items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/40"
          >
            <span>{healthy.length} healthy items</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openLow ? "" : "-rotate-90"}`} />
          </button>
          {openLow && (
            <div className="mt-2 space-y-2">
              {healthy.map((p) => (
                <ProductRow key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !error && products.length === 0 && shopId && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-white/45 text-center">
          No Printify products found in this shop.
        </div>
      )}
    </div>
  );
}

function ProductRow({ p }) {
  const isOut = p.status === "out";
  const isLow = p.status === "low";
  const Icon = isOut ? PackageX : isLow ? AlertTriangle : Package;
  const accent = isOut ? "red" : isLow ? "amber" : "primary";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-2.5">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
        {p.thumbnail_url ? (
          <img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-5 w-5 text-white/30 m-3" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{p.title}</div>
        <div className="text-[11px] text-white/45">
          {p.enabled}/{p.total} variants available
        </div>
      </div>
      <span className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold
        ${isOut ? "border-red-500/40 bg-red-500/10 text-red-300"
          : isLow ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
          : "border-primary/30 bg-primary/10 text-primary"}`}>
        <Icon className="h-3 w-3" />
        {isOut ? "Out" : isLow ? "Low" : "OK"}
      </span>
    </div>
  );
}