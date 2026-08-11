import { useEffect, useRef, useState } from "react";
import { ScanLine, MapPin, Volume2, VolumeX, X, Crosshair } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STEPS = ["SCAN", "FIND ITEM", "GET CLOSER"];

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
  const activeStep = !result ? 0 : result.found ? (atItem ? 2 : 1) : 0;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold font-heading metal-text">Shopping AI</h1>
        </div>
        <button onClick={() => setMuted((m) => !m)} className="p-2 rounded-xl border border-white/10 bg-white/[0.03]">
          {muted ? <VolumeX className="h-4 w-4 text-white/40" /> : <Volume2 className="h-4 w-4 text-primary" />}
        </button>
      </div>
      <p className="text-sm text-white/45 -mt-3">
        Scan a barcode or type an item code. Beeping intensifies as you approach the shelf.
      </p>

      {/* Step flow */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 lokin-panel p-3">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-all ${i <= activeStep ? "border-primary bg-primary/15 text-primary glow-primary" : "border-white/10 text-white/40"}`}>
                {i + 1}
              </div>
              <div className={`text-[9px] tracking-wide ${i <= activeStep ? "text-primary" : "text-white/35"}`}>{s}</div>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1.5 ${i < activeStep ? "bg-primary" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && locate()}
          placeholder="Barcode / item code"
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30"
        />
        <button onClick={locate} disabled={loading || !query.trim()} className="rounded-xl bg-primary text-primary-foreground px-5 text-sm font-bold glow-primary disabled:opacity-60 flex items-center gap-1.5">
          <Crosshair className="h-4 w-4" /> {loading ? "…" : "Find"}
        </button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {result && !result.found && (
        <div className="text-sm text-white/45 text-center py-6">{result.message}</div>
      )}

      {result?.found && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 lokin-panel p-4">
            <div className="text-xs text-primary/80 mb-1 tracking-wide">{result.item.store || "Store"} · AISLE {result.item.aisle || "?"} · SHELF {result.item.shelf || "?"}</div>
            <div className="font-semibold text-white">{result.item.name}</div>
            {result.item.price != null && <div className="text-sm text-white/55">${result.item.price.toFixed(2)}</div>}
            {result.item.barcode && <div className="text-xs text-white/35 mt-1">UPC: {result.item.barcode}</div>}
          </div>

          <div className="rounded-3xl border border-white/10 lokin-panel p-5 text-center radial-fade">
            <div className={`text-sm font-semibold tracking-wide ${atItem ? "text-primary text-glow" : "text-white/80"}`}>
              {atItem ? "YOU'RE HERE — ITEM LOCATED" : "APPROACHING…"}
            </div>
            <div className="relative h-40 flex items-end justify-center gap-1 mt-3">
              {[...Array(20)].map((_, i) => {
                const on = i < (intensity / 5);
                return (
                  <div
                    key={i}
                    className={`w-2 rounded-full transition-all ${on ? "bg-primary" : "bg-white/8"}`}
                    style={{ height: `${10 + (i / 20) * 100}%`, boxShadow: on ? "0 0 8px hsl(80 100% 50% / 0.6)" : "none" }}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs">
              <span className="text-primary font-bold animate-pulse">●</span>
              <span className="text-white/55 font-mono">{beepHz.toFixed(1)} beeps/sec · {intensity}% intensity</span>
            </div>
            <button
              onClick={() => { clearInterval(simRef.current); setSimulating(false); setDistance(100); }}
              className="mt-3 inline-flex items-center gap-1 text-xs text-white/45"
            >
              <X className="h-3 w-3" /> Stop tracking
            </button>
          </div>
        </div>
      )}

      {!result && (
        <div className="rounded-2xl border border-dashed border-white/12 p-8 text-center text-sm text-white/40">
          <MapPin className="h-7 w-7 mx-auto mb-2 text-primary/50" />
          Find any item in the store by its barcode or item code.
        </div>
      )}
    </div>
  );
}