import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { getCachedPrefs, setCachedPrefs } from "@/lib/driverPrefsCache";

// One source of truth for the driver's DriverPreference row.
// Before this, six-plus components each fired their own
// base44.entities.DriverPreference.filter({}) on mount — a duplicate request
// storm on every app load. Now a single provider fetches once, mirrors the row
// into the existing local-first cache (src/lib/driverPrefsCache.js, untouched),
// and every consumer reads from here.

const DriverPrefsContext = createContext(null);

// Module-level single-flight: the provider's mount fetch and any caller that
// needs prefs before that fetch settles share ONE in-flight request, so the
// app issues exactly one GET per load.
let inflight = null;
let loadedOnce = false;

export function loadDriverPrefs({ force = false } = {}) {
  if (!force && loadedOnce) return Promise.resolve(getCachedPrefs());
  if (inflight) return inflight;
  inflight = base44.entities.DriverPreference.filter({})
    .then((rows) => {
      const prefs = rows?.[0] || null;
      setCachedPrefs(prefs);
      loadedOnce = true;
      return prefs;
    })
    .catch(() => {
      // Network failure: fall back to the last known row so a driver keeps
      // their restored session instead of a blank state.
      const cached = getCachedPrefs();
      if (cached) loadedOnce = true;
      return cached;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function DriverPrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(() => getCachedPrefs());
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef(null);

  const refreshPrefs = useCallback(async () => {
    const next = await loadDriverPrefs({ force: true });
    setPrefs(next);
    setLoaded(true);
    return next;
  }, []);

  // Coalesce a burst of writes (explicit refreshPrefs + the realtime event they
  // trigger) into a single refetch.
  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      refreshPrefs();
    }, 250);
  }, [refreshPrefs]);

  useEffect(() => {
    let alive = true;
    loadDriverPrefs({ force: true }).then((next) => {
      if (!alive) return;
      setPrefs(next);
      setLoaded(true);
    });
    // Writes made anywhere (including src/lib/workStatusStore.js and
    // driverPrefsCache.js, which this change does not touch) keep the shared
    // state fresh without those call sites knowing about React.
    const unsubscribe = base44.entities.DriverPreference.subscribe(() => scheduleRefresh());
    return () => {
      alive = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [scheduleRefresh]);

  const value = useMemo(() => ({ prefs, loaded, refreshPrefs }), [prefs, loaded, refreshPrefs]);
  return <DriverPrefsContext.Provider value={value}>{children}</DriverPrefsContext.Provider>;
}

// Consumers that render inside the provider read shared state. The fallback
// keeps the hook safe outside the provider (never a hard crash) while still
// going through the same single-flight loader, so no extra GET is ever added.
export function useDriverPrefs() {
  const ctx = useContext(DriverPrefsContext);
  if (ctx) return ctx;
  return {
    prefs: getCachedPrefs(),
    loaded: false,
    refreshPrefs: () => loadDriverPrefs({ force: true }),
  };
}