import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Navigation, MapPin, Clock, DollarSign, Check, Radar, Flag, RefreshCw, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CATEGORY_LABELS } from "@/lib/deliveryLabels";
import DriveMusicPlayer from "@/components/DriveMusicPlayer";
import AiGps4D from "@/components/AiGps4D";
import { guardedInvoke } from "@/lib/creditGuardian";

function routePoints(n, W = 360, H = 360) {
  if (n <= 1) return [[W / 2, H / 2]];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = 50 + t * (W - 100);
    const y = H - 70 - Math.sin(t * Math.PI * 1.15) * (H * 0.42) - t * 24;
    pts.push([x, y]);
  }
  return pts;
}

export default function DrivingMode() {
  const [data, setData] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);

  useEffect(() => { load(); }, []);

  async function load(force = false) {
    setLoading(true);
    setIdx(0);
    try {
      const pl = await base44.entities.DriverPreference.filter({});
      const p = pl[0] || null;
      setPrefs(p);
      const res = await guardedInvoke(base44, "optimizeRoute", { mode: p?.optimization_mode || "most_profit" }, { force, userInitiated: force });
      setData(res.data);
    } catch (e) {
      setData({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  const stops = data?.sequenced || [];
  const total = stops.length;
  const current = stops[idx];
  const done = total > 0 && idx >= total;
  const stopPts = useMemo(
    () => (total > 1 ? routePoints(total) : total === 1 ? [[180, 180]] : []),
    [total]
  );

  const etaTotal = data?.stats?.minutes || stops.reduce((s, o) => s + (o.est_minutes || 0), 0);
  const progress = total ? Math.round((Math.min(idx, total) / total) * 100) : 0;

  function arrive() { setIdx((i) => Math.min(total, i + 1)); }
  function openMaps() {
    if (!current) return;
    const dest = current.dropoff_address || current.merchant || "";
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold font-heading metal-text">AI GPS</h1>
        </div>
        <span className="text-[11px] tracking-[0.22em] text-accent/80 font-display">LOKIN NAV</span>
      </div>

      {/* HUD radar */}
      <div className="relative rounded-3xl border border-accent/30 bg-black overflow-hidden glow-cyan">
        <div className="absolute inset-0 brand-grid opacity-25" />
        <svg viewBox="0 0 360 360" className="relative w-full aspect-square">
          <defs>
            <radialGradient id="hudGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(188 95% 50% / 0.16)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(188 95% 50%)" />
              <stop offset="100%" stopColor="hsl(80 100% 50%)" />
            </linearGradient>
            <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(188 95% 50% / 0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          <circle cx="180" cy="180" r="150" fill="url(#hudGlow)" />
          {[150, 110, 70].map((r) => (
            <circle key={r} cx="180" cy="180" r={r} fill="none" stroke="hsl(188 95% 50% / 0.18)" strokeWidth="1" />
          ))}
          <line x1="30" y1="180" x2="330" y2="180" stroke="hsl(188 95% 50% / 0.15)" strokeWidth="1" />
          <line x1="180" y1="30" x2="180" y2="330" stroke="hsl(188 95% 50% / 0.15)" strokeWidth="1" />

          {/* rotating sweep */}
          <motion.g style={{ transformOrigin: "180px 180px" }} animate={{ rotate: 360 }} transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}>
            <path d="M180 180 L180 30 A150 150 0 0 1 310 110 Z" fill="url(#sweepGrad)" />
            <line x1="180" y1="180" x2="180" y2="30" stroke="hsl(188 95% 50%)" strokeWidth="2" style={{ filter: "drop-shadow(0 0 4px hsl(188 95% 50%))" }} />
          </motion.g>

          {/* route line */}
          {stopPts.length > 1 && (
            <polyline points={stopPts.map((p) => p.join(",")).join(" ")} fill="none" stroke="url(#routeGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 5px hsl(80 100% 50% / 0.8))" }} />
          )}

          {/* stop nodes */}
          {stopPts.map((p, i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r={i === idx ? 9 : 6} fill={i < idx ? "hsl(80 100% 50% / 0.35)" : i === idx ? "hsl(80 100% 50%)" : "hsl(188 95% 50%)"} stroke="#000" strokeWidth="2" />
              {i === idx && (
                <circle cx={p[0]} cy={p[1]} r="9" fill="none" stroke="hsl(80 100% 50%)" strokeWidth="2">
                  <animate attributeName="r" values="9;20;9" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              {i < idx && <path d={`M${p[0] - 3} ${p[1]} l3 3 l6 -6`} stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            </g>
          ))}
        </svg>

        {/* HUD overlays */}
        <div className="absolute top-3 left-3 text-[10px] tracking-[0.2em] text-accent/70 font-display">ROUTING</div>
        <div className="absolute top-3 right-3 text-right">
          <div className="text-[10px] tracking-wider text-white/40">ETA</div>
          <div className="font-display text-sm font-bold text-accent text-glow-cyan">{Math.max(0, etaTotal - idx * 12)}m</div>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center justify-between text-[10px] text-white/45 mb-1">
            <span>PROGRESS</span><span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${progress}%`, boxShadow: "0 0 8px hsl(80 100% 50% / 0.8)" }} />
          </div>
        </div>
      </div>

      {/* Next stop / complete */}
      {done ? (
        <div className="rounded-3xl border border-primary/40 bg-primary/[0.08] p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10 glow-primary mb-3">
            <Flag className="h-7 w-7 text-primary" />
          </div>
          <div className="font-display text-xl font-extrabold tracking-wider text-primary text-glow">ROUTE COMPLETE</div>
          <div className="text-xs text-white/50 mt-1">All stops cleared. Lock in the next run.</div>
          <button onClick={load} className="mt-4 w-full rounded-2xl border border-white/10 lokin-panel py-3 flex items-center justify-center gap-2 text-sm font-semibold text-white/80">
            <RefreshCw className="h-4 w-4 text-primary" /> Recompute route
          </button>
        </div>
      ) : current ? (
        <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] tracking-[0.2em] text-accent/80 font-display">NEXT STOP · {idx + 1}/{total}</div>
            <span className="text-[11px] text-white/40">{CATEGORY_LABELS[current.category] || current.category}</span>
          </div>
          <div className="font-semibold text-white">{current.merchant}</div>
          <div className="text-xs text-white/45 flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <span className="truncate">{current.dropoff_address || "—"}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <HudStat icon={Navigation} label="miles" value={`${current.miles}mi`} />
            <HudStat icon={Clock} label="eta" value={`${current.est_minutes}m`} />
            <HudStat icon={DollarSign} label="payout" value={`$${current.rate?.gross ?? current.payout ?? 0}`} accent />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button onClick={openMaps} className="rounded-2xl bg-primary text-primary-foreground py-3 flex items-center justify-center gap-1.5 text-sm font-bold glow-primary active:scale-[0.99] transition-transform">
              <Navigation className="h-4 w-4" /> Navigate
            </button>
            <button onClick={arrive} className="rounded-2xl border border-accent/40 bg-accent/[0.08] text-accent py-3 flex items-center justify-center gap-1.5 text-sm font-bold active:scale-[0.99] transition-transform">
              <Check className="h-4 w-4" /> Arrived
            </button>
          </div>
          <Link to="/active-delivery" className="flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/[0.06] px-3 py-2.5 active:scale-[0.99] transition-transform">
            <span className="text-xs font-semibold text-primary">Open Active Delivery</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
          </Link>
        </div>
      ) : loading ? (
        <div className="rounded-3xl border border-white/10 lokin-panel p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-accent/70">
            <Radar className="h-4 w-4 animate-pulse" /> LOKIN is scanning for offers…
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 lokin-panel p-6 text-center">
          <div className="text-sm text-white/50">{data?.error || "No offers match your filters."}</div>
          <button onClick={load} className="mt-3 w-full rounded-2xl border border-white/10 lokin-panel py-2.5 flex items-center justify-center gap-2 text-sm text-white/70">
            <RefreshCw className="h-4 w-4 text-primary" /> Retry
          </button>
        </div>
      )}

      {data?.stats && !done && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <MiniStat label="trip miles" value={`${data.stats.miles}mi`} />
          <MiniStat label="net" value={`$${data.stats.net}`} accent />
          <MiniStat label="net/hr" value={`$${data.stats.perHour}`} accent />
        </div>
      )}

      <AiGps4D stops={stops} compact />

      <DriveMusicPlayer />
    </div>
  );
}

function HudStat({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2">
      <div className="flex items-center justify-center gap-1 text-[10px] text-white/40">
        <Icon className="h-3 w-3 text-primary" /> {label}
      </div>
      <div className={`font-display text-base font-bold mt-0.5 ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2">
      <div className={`font-bold ${accent ? "text-primary" : "text-white"}`}>{value}</div>
      <div className="text-white/40 text-[10px]">{label}</div>
    </div>
  );
}