// GPS quick search (locked navigation surface): search a store, restaurant, or
// address while navigating and jump navigation straight to it. Results come
// from the same live Mapbox geocoder the route engine uses — nothing invented.
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";

export default function GpsQuickSearch({ onClose, proximity, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seqRef = useRef(0);
  const inputRef = useRef(null);
  const proximityRef = useRef(proximity);

  useEffect(() => {
    proximityRef.current = proximity;
  }, [proximity]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setError("");
      setLoading(false);
      return undefined;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await guardedInvoke(base44, "navigation-engine", {
          action: "search_places",
          query: q,
          proximity: proximityRef.current,
        });
        if (seq !== seqRef.current) return;
        setResults(Array.isArray(res.data?.results) ? res.data.results : []);
        setError("");
      } catch (e) {
        if (seq !== seqRef.current) return;
        setResults([]);
        setError(e?.response?.data?.error || e?.message || "Search failed — try again.");
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="absolute inset-x-3 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-50 flex max-h-[60dvh] flex-col rounded-3xl border border-white/12 bg-black/95 p-3.5 shadow-[0_14px_44px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-accent/25 bg-black/70 px-3">
          <Search className="h-4 w-4 shrink-0 text-accent" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Store, restaurant, or address"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/25"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent/70" />}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white/60 active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <div className="mt-2 text-[11px] text-red-300">{error}</div>}
      {!error && query.trim().length >= 3 && !loading && !results.length && (
        <div className="mt-2 text-[11px] text-white/40">No live matches — add a city or ZIP and try again.</div>
      )}
      {results.length > 0 && (
        <div className="no-scrollbar mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={`${r.longitude},${r.latitude},${i}`}
              type="button"
              onClick={() => onSelect(String(r.full_address || `${r.name} ${r.full_address || ""}`.trim() || r.name || ""))}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-left active:scale-[0.98]"
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">{r.name || "Unnamed place"}</div>
                {r.full_address && <div className="truncate text-[11px] text-white/45">{r.full_address}</div>}
              </div>
              {r.distance_miles != null && Number(r.distance_miles) < 60 && (
                <div className="shrink-0 text-[11px] font-bold text-primary/80">{Number(r.distance_miles).toFixed(1)} mi</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}