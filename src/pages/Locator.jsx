import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ScanLine, MapPin, Crosshair, PackageSearch, Store, Boxes, Clock3, Navigation, Layers3, Volume2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { normalizeInventoryItem, inventoryFreshness } from "@/lib/retailInventory";
import { optimizeStoreRoute, substitutionRisk } from "@/lib/storeIntelligence";
import BeepSeekScanner from "@/components/locator/BeepSeekScanner";
import ScanToSearch from "@/components/locator/ScanToSearch";
import OrderItemsImport from "@/components/OrderItemsImport";
import { guardedInvoke } from "@/lib/creditGuardian";

const STEPS = ["SEARCH", "STORE MAP", "AISLE / SHELF"];

function stockMeta(item) {
  const count = Number(item?.inventory_count ?? 0);
  const status = item?.inventory_status || (count > 5 ? "in_stock" : count > 0 ? "low_stock" : "unknown");
  if (status === "out_of_stock") return { label: "Out of stock", cls: "text-red-400 border-red-500/25 bg-red-500/[0.06]" };
  if (status === "low_stock") return { label: `${count} left`, cls: "text-amber-300 border-amber-400/25 bg-amber-400/[0.06]" };
  if (status === "in_stock") return { label: `${count} in stock`, cls: "text-primary border-primary/25 bg-primary/[0.06]" };
  return { label: count > 0 ? `${count} available` : "Inventory unavailable", cls: "text-white/55 border-white/10 bg-white/[0.03]" };
}

function derivePoint(item) {
  // Real coordinates only: must be finite AND flagged verified. Otherwise
  // return null so the UI shows aisle/shelf text instead of a fake pin.
  // Kendall's rule: real and true in detail only — no invented locations.
  if (Number.isFinite(item?.map_x) && Number.isFinite(item?.map_y) && item?.map_verified) {
    return [item.map_x, item.map_y];
  }
  return null;
}

export default function Locator() {
  const [searchParams] = useSearchParams();
  const autoImport = searchParams.get("import") === "1";
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [beepSeek, setBeepSeek] = useState(false);
  const [scanSearch, setScanSearch] = useState(false);
  const [tripItems, setTripItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lokin_smart_shop") || "[]"); } catch { return []; }
  });

  async function locate(searchValue = query) {
    if (!String(searchValue).trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await guardedInvoke(base44, "locateItem", { query: String(searchValue).trim() }, { userInitiated: true });
      setResult(res.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function handleScanned(code) {
    setScanSearch(false);
    const value = String(code || "").trim();
    if (!value) return;
    setQuery(value);
    locate(value);
  }

  useEffect(() => { localStorage.setItem("lokin_smart_shop", JSON.stringify(tripItems)); }, [tripItems]);

  const activeStep = !result ? 0 : result.found ? 2 : 0;
  const item = result?.item ? normalizeInventoryItem(result.item) : null;
  const stock = stockMeta(item);
  const freshness = inventoryFreshness(item?.last_inventory_update);
  const mapPoint = derivePoint(item);
  const hasRealMap = !!mapPoint;
  const optimizedTrip = optimizeStoreRoute(tripItems);

  function addToTrip() {
    if (!item || tripItems.some((x) => (x.id || x.barcode) === (item.id || item.barcode))) return;
    setTripItems((xs) => [...xs, item]);
  }

  function removeFromTrip(target) {
    const key = target.id || target.barcode || target.name;
    setTripItems((xs) => xs.filter((x) => (x.id || x.barcode || x.name) !== key));
  }

  function clearTrip() { setTripItems([]); }

  // Merge OCR-imported order items into the Smart Shop trip, skipping
  // duplicates already on the list (matched by normalized name).
  function importOrderItems(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return;
    setTripItems((xs) => {
      const have = new Set(xs.map((x) => String(x.name || "").trim().toLowerCase()));
      const fresh = [];
      for (const it of list) {
        const name = String(it?.name || "").trim();
        if (!name) continue;
        if (have.has(name.toLowerCase())) continue;
        have.add(name.toLowerCase());
        fresh.push({
          id: `order-${Date.now()}-${fresh.length}`,
          name,
          quantity: Number(it.quantity) > 0 ? Math.round(Number(it.quantity)) : 1,
          unit: it.unit || "",
          source: "order_import",
        });
      }
      return [...xs, ...fresh];
    });
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="lokin-kicker lokin-kicker-lime">LOCATOR</div>
      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
        <div>
          <div className="flex items-center gap-2 text-primary"><PackageSearch className="h-5 w-5"/><span className="text-[11px] tracking-[0.2em] font-display">LOKIN ITEM LOCATOR</span></div>
          <h1 className="mt-2 text-3xl font-extrabold font-display metal-text">Find it. Know it. Grab it.</h1>
          <p className="mt-2 text-sm text-white/50">Search an item, see the store-provided aisle/shelf when available, review inventory freshness, and follow the store-map position.</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 lokin-panel lokin-card p-3">
        {STEPS.map((s, i) => <div key={s} className="flex-1 flex items-center">
          <div className="flex flex-col items-center gap-1"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 ${i <= activeStep ? "border-primary bg-primary/15 text-primary glow-primary" : "border-white/10 text-white/40"}`}>{i + 1}</div><div className={`text-[9px] tracking-wide ${i <= activeStep ? "text-primary" : "text-white/35"}`}>{s}</div></div>
          {i < 2 && <div className={`flex-1 h-px mx-1.5 ${i < activeStep ? "bg-primary" : "bg-white/10"}`} />}
        </div>)}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1"><ScanLine className="absolute left-3 top-3 h-4 w-4 text-primary/60"/><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && locate()} placeholder="Barcode, item code, or product name" className="w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-9 pr-3 py-3 text-sm text-white placeholder:text-white/30"/></div>
        <button onClick={() => locate()} disabled={loading || !query.trim()} className="rounded-2xl bg-primary text-primary-foreground px-5 text-sm font-bold glow-primary disabled:opacity-50"><Crosshair className="h-4 w-4"/></button>
        <button type="button" aria-label="Scan barcode with camera" onClick={() => setScanSearch(true)} className="rounded-2xl border border-primary/30 bg-primary/[0.06] px-5 text-primary active:scale-95"><ScanLine className="h-4 w-4"/></button>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-3 text-sm text-red-300">{error}</div>}
      {result && !result.found && <div className="rounded-2xl border border-white/10 p-5 text-sm text-white/45 text-center">{result.message}</div>}

      {item && <>
        <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0"><div className="text-[10px] tracking-[0.18em] text-primary/75">{item.department || "STORE ITEM"}</div><div className="mt-1 font-bold text-white text-lg leading-tight">{item.name}</div><div className="mt-1 text-xs text-white/45">{item.store || "Selected store"} · Aisle {item.aisle || "?"} · Shelf {item.shelf || "?"}</div></div>
            {item.price != null && <div className="text-right"><div className="text-2xl font-extrabold text-primary">${Number(item.price).toFixed(2)}</div><div className="text-[10px] text-white/35">store price</div></div>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${stock.cls}`}><Boxes className="inline h-3.5 w-3.5 mr-1"/>{stock.label}</span>
            {item.map_zone && <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60"><Layers3 className="inline h-3.5 w-3.5 mr-1"/>Zone {item.map_zone}</span>}
          </div>
          <button onClick={addToTrip} className="mt-3 w-full rounded-xl border border-primary/25 bg-primary/[0.06] py-2 text-xs font-bold text-primary disabled:opacity-40" disabled={tripItems.some((x) => (x.id || x.barcode) === (item.id || item.barcode))}>{tripItems.some((x) => (x.id || x.barcode) === (item.id || item.barcode)) ? "ADDED TO SMART SHOP" : "+ ADD TO SMART SHOP"}</button>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/35">
            <span className="flex items-center gap-1"><Clock3 className="h-3 w-3"/>{freshness.label}</span>
            <span className={item.inventory_verified ? "text-primary/70" : "text-amber-300/70"}>{item.inventory_verified ? "VERIFIED STORE FEED" : "ESTIMATE / UNVERIFIED"}</span>
            <span>{item.inventory_source_label}</span>
          </div>
        </div>

        <div className="rounded-3xl border border-primary/20 bg-black overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/8"><div><div className="text-[10px] tracking-[0.18em] text-primary/70">STORE MAP</div><div className="text-sm font-bold text-white">Aisle {item.aisle || "?"} · Shelf {item.shelf || "?"}</div></div><Navigation className="h-5 w-5 text-primary"/></div>
          <div className="relative aspect-[4/3] bg-[linear-gradient(rgba(162,235,27,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(162,235,27,.04)_1px,transparent_1px)] bg-[size:24px_24px]">
            {[18,34,50,66,82].map((x,i)=><div key={x} className="absolute top-[12%] bottom-[12%] w-[9%] rounded-xl border border-white/10 bg-white/[0.03]" style={{left:`${x}%`}}><div className="text-center text-[9px] text-white/25 pt-1">A{i+1}</div></div>)}
            <div className="absolute left-[4%] bottom-[4%] rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-[9px] text-white/40">ENTRANCE</div>
            {hasRealMap ? (
              <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{left:`${mapPoint[0]}%`,top:`${mapPoint[1]}%`}}>
                <div className="absolute -inset-4 rounded-full bg-primary/10 animate-ping"/><div className="relative h-8 w-8 rounded-full bg-primary text-black border-4 border-black flex items-center justify-center glow-primary"><MapPin className="h-4 w-4"/></div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl border border-amber-400/25 bg-black/80 px-4 py-3 text-center">
                  <div className="text-xs font-bold text-amber-300">No verified store map on file</div>
                  <div className="mt-1 text-[10px] text-white/45">Head to Aisle {item.aisle || "?"} · Shelf {item.shelf || "?"}</div>
                </div>
              </div>
            )}
            <div className="absolute right-3 top-3 rounded-xl border border-primary/25 bg-black/80 px-3 py-2 text-right"><div className="text-[9px] text-white/40">TARGET</div><div className="text-xs font-bold text-primary">{item.aisle || "?"} · {item.shelf || "?"}</div></div>
          </div>
          <div className="p-3 text-[10px] text-white/35">Pin shows only with a verified store layout on file. Otherwise LOKIN guides by aisle and shelf — never an invented map position. Inventory is only labeled verified when a connected source supplies freshness data.</div>
        </div>

        <div className="rounded-3xl border border-primary/20 lokin-panel lokin-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.06]"><Volume2 className="h-4 w-4 text-primary" /></div>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">Beep Seek — audio homing</div><div className="mt-1 text-[11px] leading-relaxed text-white/45">Point your camera along the shelf. LOKIN listens for the target barcode and beeps faster the closer it fills the frame — a continuous rapid chirp means you're on it. Distance comes from the real camera signal, never simulated.</div>
            <button type="button" onClick={() => setBeepSeek(true)} disabled={!item.barcode && !item.item_code} className="mt-3 w-full rounded-xl border border-primary/25 bg-primary/[0.06] py-2.5 text-xs font-bold text-primary disabled:opacity-40"><Volume2 className="mr-1 inline h-3.5 w-3.5" />{item.barcode || item.item_code ? "START BEEP SEEK" : "NO TARGET CODE ON RECORD"}</button></div>
          </div>
        </div>
      </>}

      <OrderItemsImport onImport={importOrderItems} autoOpen={autoImport} />

      {tripItems.length > 0 && <div className="rounded-3xl border border-primary/20 lokin-panel p-4">
        <div className="flex items-center justify-between"><div><div className="text-[10px] tracking-[0.18em] text-primary">SMART SHOP ROUTE</div><div className="text-sm font-bold text-white">{tripItems.length} item{tripItems.length === 1 ? "" : "s"} · optimized walking order</div></div><button onClick={clearTrip} className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/45">CLEAR</button></div>
        <div className="mt-3 space-y-2">{optimizedTrip.map((x) => <div key={x.id || x.barcode || x.name} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/30 p-2.5"><div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold flex items-center justify-center">{x.route_order}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-white">{x.name}</div><div className="text-[10px] text-white/40">Aisle {x.aisle || "?"} · Shelf {x.shelf || "?"}{x._point?.estimated ? " · estimated map point" : " · store map point"}</div></div><div className="text-right"><div className={`text-[9px] font-bold ${substitutionRisk(x) === "high" ? "text-red-400" : substitutionRisk(x) === "medium" ? "text-amber-300" : "text-primary/70"}`}>{substitutionRisk(x) === "high" ? "SUB NEEDED" : substitutionRisk(x) === "medium" ? "LOW STOCK" : "READY"}</div><button onClick={() => removeFromTrip(x)} className="mt-1 text-[9px] text-white/30">REMOVE</button></div></div>)}</div>
        <div className="mt-3 text-[10px] text-white/35">LOKIN orders stops from the entrance using available store coordinates. Low/out-of-stock items are surfaced before you waste time walking to them.</div>
      </div>}

      {scanSearch && (
        <ScanToSearch onCode={handleScanned} onClose={() => setScanSearch(false)} />
      )}

      {beepSeek && item && (
        <BeepSeekScanner
          target={{ name: item.name, codes: [item.barcode, item.item_code] }}
          onClose={() => setBeepSeek(false)}
        />
      )}

      {!result && <div className="rounded-3xl border border-dashed border-white/12 p-8 text-center text-sm text-white/40"><Store className="h-8 w-8 mx-auto mb-2 text-primary/50"/><div className="font-semibold text-white/65">Store intelligence, not just a barcode scanner.</div><div className="mt-1">LOKIN can show where the item should be and how many units the connected store says are available.</div></div>}
    </div>
  );
}