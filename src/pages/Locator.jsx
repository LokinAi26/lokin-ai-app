import { useEffect, useRef, useState } from "react";
import { ScanLine, MapPin, Volume2, VolumeX, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Locator() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [distance, setDistance] = useState(100); // 0 = at item, 100 = far
  const [simulating, setSimulating] = useState(false);
  const simRef = useRef(null);
  const audioRef = useRef(null);

  async function locate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await base44.functions.invoke("locateItem", { query });
      setResult(res.data);
      if (res.data.found) {
        setDistance(res.data.distance ?? 80);
        startSim();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // "Approach" simulation: distance decreases over time; beep rate scales inversely.
  function startSim() {
    clearInterval(simRef.current);
    setSimulating(true);
    simRef.current = setInterval(() => {
      setDistance((d) => {
        const next = Math.max(0, d - 4 + (Math.random() * 6 - 3));
        return Math.round(next);
      });
    }, 700);
  }
  useEffect(() => () => clearInterval(simRef.current), []);

  // Beep interval depends on distance
  const beepHz = distance <= 4 ? 1 : distance <= 20 ? 2.5 : distance <= 50 ? 1.2 : 0.6;
  const atItem = distance <= 3;

  useEffect(() => {
    if (!simulating || muted) return;
    let timer;
    const tick = () => {
      playBeep(atItem ? 880 : 520);
      timer = setTimeout(tick, 1000 / beepHz);
    };
    timer = setTimeout(tick, 1000 / beepHz);
    return () => clearTimeout(timer);
  }, [simulating, muted, beepHz, atItem]);

  function playBeep(freq = 600) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }

  const intensity = Math.round(100 - distance); // 0..100

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold font-heading">Item Locator</h1>
        </div>
        <button onClick={() => setMuted((m) => !m)} className="p-2 rounded-lg border border-border">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Scan a barcode or type an item code. Beeping intensifies as you approach the shelf.
      </p>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && locate()}
          placeholder="Barcode / item code"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <button onClick={locate} disabled={loading || !query.trim()} className="rounded-lg bg-primary text-primary-foreground px-4 text-sm font-semibold disabled:opacity-60">
          {loading ? "…" : "Find"}
        </button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {result && !result.found && (
        <div className="text-sm text-muted-foreground text-center py-6">{result.message}</div>
      )}

      {result?.found && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">{result.item.store || "Store"} · Aisle {result.item.aisle || "?"} · Shelf {result.item.shelf || "?"}</div>
            <div className="font-semibold">{result.item.name}</div>
            {result.item.price != null && <div className="text-sm text-muted-foreground">${result.item.price.toFixed(2)}</div>}
            {result.item.barcode && <div className="text-xs text-muted-foreground mt-1">UPC: {result.item.barcode}</div>}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <div className="text-sm font-semibold mb-1">{atItem ? "You're here! 🎯" : "Approaching…"}</div>
            <div className="relative h-40 flex items-end justify-center gap-1">
              {[...Array(20)].map((_, i) => {
                const on = i < (intensity / 5);
                return (
                  <div
                    key={i}
                    className={`w-2 rounded-full transition-all ${on ? (atItem ? "bg-emerald-500" : "bg-amber-500") : "bg-muted"}`}
                    style={{ height: `${10 + (i / 20) * 100}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Distance {distance}/100 · {intensity}% intensity · {beepHz.toFixed(1)} beeps/sec
            </div>
            <button
              onClick={() => { clearInterval(simRef.current); setSimulating(false); setDistance(100); }}
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground"
            >
              <X className="h-3 w-3" /> Stop tracking
            </button>
          </div>
        </div>
      )}

      {!result && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <MapPin className="h-6 w-6 mx-auto mb-2 opacity-50" />
          Find any item in the store by its barcode or item code.
        </div>
      )}
    </div>
  );
}