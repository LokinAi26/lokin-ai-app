import { useEffect, useState } from "react";

export default function useLokinPerformance() {
  const [state, setState] = useState(() => window.LOKINPerformance || { effectiveMode: "balanced", reducePolling: false, reduceAnimations: false, pauseNonessential: false });
  useEffect(() => {
    const onMode = (e) => setState(e.detail || window.LOKINPerformance || {});
    window.addEventListener("lokin:performance-mode", onMode);
    if (window.LOKINPerformance) setState(window.LOKINPerformance);
    return () => window.removeEventListener("lokin:performance-mode", onMode);
  }, []);
  return state;
}

export function cadenceFor(perf, normalMs, saverMs, hiddenMs = Math.max(saverMs, normalMs * 4)) {
  if (perf?.pauseNonessential) return hiddenMs;
  if (perf?.reducePolling || perf?.effectiveMode === "battery_saver") return saverMs;
  if (perf?.effectiveMode === "performance") return Math.max(1000, Math.round(normalMs * 0.75));
  return normalMs;
}
