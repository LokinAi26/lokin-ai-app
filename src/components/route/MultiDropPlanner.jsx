import { useState } from "react";
import { Navigation, Plus, Timer, X, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44LiveFunctions } from "@/api/base44Client";
import { saveOptimizedRouteSession } from "@/lib/optimizedRouteSession";

const MAX_DROPS = 10;

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS is unavailable — type a starting address instead"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ longitude: pos.coords.longitude, latitude: pos.coords.latitude }),
      (err) => reject(new Error(err.message || "Could not get your GPS location — type a starting address instead")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

// LOKIN AI multi-drop planner: enter several delivery drop-offs and the
// navigation engine sequences them into the fastest, fuel-saving order.
export default function MultiDropPlanner() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [input, setInput] = useState("");
  const [drops, setDrops] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function addDrop() {
    const value = input.trim();
    if (!value || drops.includes(value) || drops.length >= MAX_DROPS) return;
    setDrops((list) => [...list, value]);
    setInput("");
    setResult(null);
  }

  function removeDrop(drop) {
    setDrops((list) => list.filter((d) => d !== drop));
    setResult(null);
  }

  async function plan() {
    if (drops.length < 2 || planning) return;
    setPlanning(true);
    setError("");
    setResult(null);
    try {
      const originAddress = origin.trim();
      const originCoordinate = originAddress ? null : await getCurrentPosition();
      const res = await base44LiveFunctions.functions.invoke("navigation-engine", {
        action: "plan_drops",
        drops,
        ...(originCoordinate ? { origin_coordinate: originCoordinate } : { origin_address: originAddress }),
      });
      const plan = res.data?.plan;
      if (!plan) throw new Error(res.data?.error || "Could not plan this route");
      setResult(plan);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Could not plan this route");
    } finally {
      setPlanning(false);
    }
  }

  function startNavigation() {
    const saved = saveOptimizedRouteSession({
      mode: "fastest",
      originAddress: origin.trim(),
      stops: result.stops.map((s, i) => ({
        id: `drop-${i + 1}`,
        merchant: s.name || s.full_address || s.input,
        dropoff_address: s.full_address || s.input,
      })),
    });
    if (!saved) {
      setError("Could not transfer this route to GPS. Keep this screen open and try again.");
      return;
    }
    navigate("/ai-gps?focus=locked&nav=1&view=real&source=multi-drop");
  }

  return (
    <div className="lokin-card space-y-3 p-4">
      <div className="lokin-kicker lokin-kicker-lime flex items-center gap-2">
        <Zap className="h-4 w-4" /> MULTI-DROP FASTEST ROUTE
      </div>
      <p className="-mt-1 text-xs text-white/45">
        Add your delivery drop-offs and LOKIN AI sequences the fastest, fuel-saving order with live traffic.
      </p>

      <input
        value={origin}
        onChange={(e) => { setOrigin(e.target.value); setResult(null); }}
        placeholder="Starting point (leave blank to use current GPS)"
        className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30"
      />

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDrop(); } }}
          placeholder="Drop-off address, then tap +"
          className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30"
        />
        <button
          type="button"
          aria-label="Add drop-off"
          onClick={addDrop}
          disabled={!input.trim() || drops.length >= MAX_DROPS}
          className="min-h-12 w-12 shrink-0 rounded-xl bg-primary font-black text-primary-foreground glow-primary disabled:opacity-50"
        >
          <Plus className="mx-auto h-5 w-5" />
        </button>
      </div>

      {drops.length > 0 && (
        <div className="space-y-1.5">
          {drops.map((drop, i) => (
            <div key={drop} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3">
              <span className="min-w-0 truncate text-sm text-white/80">
                <span className="mr-1.5 font-bold text-primary">{i + 1}</span>
                {drop}
              </span>
              <button
                type="button"
                aria-label={`Remove ${drop}`}
                onClick={() => removeDrop(drop)}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-white/50 active:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={plan}
        disabled={drops.length < 2 || planning}
        className="min-h-12 w-full rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground glow-primary disabled:opacity-60"
      >
        {planning ? "PLANNING FASTEST ROUTE…" : drops.length >= 2 ? `PLAN FASTEST ROUTE · ${drops.length} DROPS` : "ADD 2+ DROP-OFFS TO PLAN"}
      </button>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {result && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2">
              <div className="font-bold text-white">{result.totals.minutes}m</div>
              <div className="text-[10px] text-white/40">drive time</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2">
              <div className="font-bold text-white">{result.totals.miles} mi</div>
              <div className="text-[10px] text-white/40">total miles</div>
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/[0.08] p-2">
              <div className="font-bold text-primary">${result.totals.fuel}</div>
              <div className="text-[10px] text-white/40">fuel est.</div>
            </div>
          </div>

          {result.baseline && (result.baseline.saved_minutes > 0 || result.baseline.saved_miles > 0) ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-center text-xs font-bold text-primary">
              FASTEST ORDER SAVES ~{[
                result.baseline.saved_minutes > 0 ? `${result.baseline.saved_minutes} MIN` : null,
                result.baseline.saved_miles > 0 ? `${result.baseline.saved_miles} MI` : null,
              ].filter(Boolean).join(" & ")} VS YOUR ENTERED ORDER
            </div>
          ) : result.baseline ? (
            <div className="text-xs text-white/45">Your entered order is already the fastest sequence.</div>
          ) : null}

          <div className="space-y-1.5">
            {result.stops.map((stop, i) => {
              const leg = result.legs?.[i];
              return (
                <div key={stop.sequence} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground glow-primary">
                    {stop.sequence}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{stop.name || stop.input}</div>
                    <div className="truncate text-xs text-white/45">{stop.full_address}</div>
                    {leg && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-white/55">
                        <Timer className="h-3 w-3 text-primary" />
                        {(leg.distance_m / 1609.344).toFixed(1)} mi · {Math.max(1, Math.round(leg.duration_s / 60))} min drive
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={startNavigation}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground glow-primary"
          >
            <Navigation className="h-4 w-4" /> START LOKIN NAVIGATION
          </button>
        </div>
      )}
    </div>
  );
}