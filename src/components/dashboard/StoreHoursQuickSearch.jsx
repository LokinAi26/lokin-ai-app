// Store Hours Quick Search (dashboard, 2026-10-08): type a store name, get its
// live location candidates and current operating-hours status. Uses the
// existing navigation-engine actions: `search_places` (Mapbox POI search,
// proximity-ranked around the driver) and `dest_hours` (OSM opening hours).
// Honest-data rule: a candidate with no OSM hours shows "Hours not on record"
// — never invented.
import { useState } from "react";
import { Clock, MapPin, Search, Store, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { describeHours } from "@/lib/openingHours";

const MAX_RESULTS = 4;

function driverPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

function statusMeta(hrs) {
  if (!hrs) return { label: "NO HOURS ON RECORD", cls: "text-white/40 border-white/15 bg-white/[0.04]" };
  const { text, raw } = describeHours(hrs);
  if (raw) return { label: "HOURS: RAW SPEC", cls: "text-white/45 border-white/15 bg-white/[0.04]", detail: text };
  if (text.startsWith("Open")) return { label: text.toUpperCase(), cls: "text-primary border-primary/40 bg-primary/10" };
  return { label: text.toUpperCase(), cls: "text-red-300 border-red-400/30 bg-red-500/[0.08]" };
}

export default function StoreHoursQuickSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = idle
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search(e) {
    e?.preventDefault?.();
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError("");
    setResults(null);
    try {
      const proximity = await driverPosition();
      const res = await base44.functions.invoke("navigation-engine", {
        action: "search_places",
        query: q,
        proximity,
      });
      const places = (res?.data?.results || []).slice(0, MAX_RESULTS);
      if (!places.length) {
        setError(`No place matched "${q}" nearby.`);
        return;
      }
      // Hours for the matched candidates in parallel; a failed/absent lookup
      // stays null — the row renders without an hours line.
      const withHours = await Promise.all(
        places.map(async (place) => {
          try {
            const hrs = await base44.functions.invoke("navigation-engine", {
              action: "dest_hours",
              coordinate: { longitude: place.longitude, latitude: place.latitude },
              name: place.name,
            });
            return { ...place, hours: hrs?.data?.opening_hours || null };
          } catch {
            return { ...place, hours: null };
          }
        }),
      );
      setResults(withHours);
    } catch {
      setError("Look-up failed — check connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 rounded-2xl border border-white/10 lokin-panel overflow-hidden">
      <form onSubmit={search} className="flex items-center gap-2 p-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/12 bg-black/40 px-3 py-2.5">
          <Store className="h-4 w-4 shrink-0 text-primary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Store name — e.g. Walmart…"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setResults(null); setError(""); }} className="text-white/35 active:scale-90">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || !query.trim()}
          aria-label="Check store hours"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Search className={`h-4.5 w-4.5 ${busy ? "animate-pulse" : ""}`} />
        </button>
      </form>

      {busy && <div className="px-3 pb-2.5 text-xs text-white/50">Checking hours for stores near you…</div>}
      {error && !busy && <div className="px-3 pb-2.5 text-xs text-amber-200">{error}</div>}

      {results?.length > 0 && (
        <div className="space-y-1.5 px-2 pb-2">
          {results.map((r, i) => {
            const meta = statusMeta(r.hours);
            return (
              <div key={`${r.longitude},${r.latitude},${i}`} className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-white/90">{r.name}</div>
                    <div className="flex items-center gap-1 text-[10px] text-white/40">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{r.full_address || "Address on record"}</span>
                      {r.distance_miles != null && <span className="shrink-0">· {r.distance_miles} mi</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-extrabold tracking-[0.06em] ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
                {meta.detail && <div className="mt-1 text-[10px] text-white/40">{meta.detail}</div>}
              </div>
            );
          })}
          <div className="flex items-center gap-1 px-1 pt-0.5 text-[8px] text-white/25">
            <Clock className="h-2.5 w-2.5" /> Live hours from OpenStreetMap — verify with the store before driving.
          </div>
        </div>
      )}
    </div>
  );
}