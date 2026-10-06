import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

// One source of truth for Earning rows.
// EarningsDashboard, IncomeSection and GlobalVoiceAssistant all read the same
// rows; each used to issue its own base44.entities.Earning.filter(...) on
// mount. A single provider now loads them once and shares the list.

const EarningsContext = createContext(null);

export function EarningsProvider({ children }) {
  const [earnings, setEarnings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef(null);

  const refreshEarnings = useCallback(async () => {
    const rows = await base44.entities.Earning.filter({}, "-date", 500).catch(() => []);
    setEarnings(rows || []);
    setLoaded(true);
    return rows || [];
  }, []);

  // Coalesce the explicit post-write refresh with the realtime event it fires.
  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      refreshEarnings();
    }, 250);
  }, [refreshEarnings]);

  useEffect(() => {
    let alive = true;
    base44.entities.Earning.filter({}, "-date", 500)
      .then((rows) => {
        if (!alive) return;
        setEarnings(rows || []);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    // Writes made anywhere (screenshot import, manual entry, settings export)
    // keep the shared list fresh.
    const unsubscribe = base44.entities.Earning.subscribe(() => scheduleRefresh());
    return () => {
      alive = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [scheduleRefresh]);

  const value = useMemo(() => ({ earnings, loaded, refreshEarnings }), [earnings, loaded, refreshEarnings]);
  return <EarningsContext.Provider value={value}>{children}</EarningsContext.Provider>;
}

export function useEarnings() {
  const ctx = useContext(EarningsContext);
  if (ctx) return ctx;
  return { earnings: [], loaded: false, refreshEarnings: () => Promise.resolve([]) };
}