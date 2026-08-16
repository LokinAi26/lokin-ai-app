import { useEffect, useState } from "react";
import { Cloud, Trophy, TrendingUp, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import useLokinPerformance, { cadenceFor } from "@/hooks/useLokinPerformance";

// Horizontal scrolling ticker: weather, sports scores, stock prices.
export default function Ticker({ location }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const perf = useLokinPerformance();

  async function load() {
    setLoading(true);
    try {
      const res = await guardedInvoke(base44, "getTicker", { location: location || "" });
      const d = res.data;
      const list = [];
      if (d?.weather && (d.weather.temp_f || d.weather.temp_f === 0)) {
        list.push({
          icon: "weather",
          color: "text-accent",
          text: `${d.weather.location || location || "Weather"}: ${Math.round(d.weather.temp_f)}°F ${d.weather.condition || ""}`.trim(),
        });
      }
      (d?.sports || []).forEach((s) =>
        list.push({ icon: "sport", color: "text-primary", text: s.text })
      );
      (d?.stocks || []).forEach((s) => {
        const up = (s.change_percent || 0) >= 0;
        list.push({
          icon: "stock",
          color: up ? "text-primary" : "text-destructive",
          text: `${s.symbol} $${(s.price || 0).toFixed(2)} ${up ? "▲" : "▼"}${Math.abs(s.change_percent || 0).toFixed(1)}%`,
        });
      });
      setItems(list.length ? list : [{ icon: "weather", color: "text-white/40", text: "Live ticker unavailable" }]);
    } catch {
      setItems([{ icon: "weather", color: "text-white/40", text: "Live ticker unavailable" }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, cadenceFor(perf, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000));
    return () => clearInterval(id);
  }, [location, perf?.effectiveMode, perf?.pauseNonessential]);

  function Glyph({ item }) {
    if (item.icon === "weather") return <Cloud className={`h-3.5 w-3.5 shrink-0 ${item.color}`} />;
    if (item.icon === "sport") return <Trophy className={`h-3.5 w-3.5 shrink-0 ${item.color}`} />;
    return <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${item.color}`} />;
  }

  if (loading && items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 lokin-panel py-2 px-3 flex items-center gap-2">
        <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
        <span className="text-xs text-white/40">Loading live ticker…</span>
      </div>
    );
  }

  const loop = [...items, ...items]; // duplicate for seamless scroll
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 lokin-panel py-2">
      <div className={`flex gap-8 whitespace-nowrap will-change-transform ${perf?.reduceAnimations ? "" : "ticker-scroll"}`}>
        {loop.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 shrink-0">
            <Glyph item={it} /> {it.text}
          </span>
        ))}
      </div>
    </div>
  );
}