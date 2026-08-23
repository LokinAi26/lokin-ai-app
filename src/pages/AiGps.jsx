import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Lock, MapPin, Mic, Move, Navigation, Pause, Power, Radar, RefreshCw, Route as RouteIcon, Satellite, Volume2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AiGps4D from "@/components/AiGps4D";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import useLokinNavigation from "@/hooks/useLokinNavigation";
import { dispatchLokinCommand, LOKIN_COMMANDS } from "@/lib/lokinCommandBus";
import { formatDistance, formatDuration } from "@/lib/navigationGeometry";

export default function AiGps() {
  const [params] = useSearchParams();
  const locked = params.get("focus") === "locked";
  const orderId = params.get("order") || "";
  const explicitDestination = params.get("destination") || "";
  const [stops, setStops] = useState([]);
  const [routeLoadError, setRouteLoadError] = useState("");
  const [loadingStops, setLoadingStops] = useState(true);
  const [voiceGuidance, setVoiceGuidance] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoadingStops(true);
    guardedInvoke(base44, "optimizeRoute", { mode: "most_profit" })
      .then((res) => {
        if (!alive) return;
        setStops(res.data?.sequenced || []);
        setRouteLoadError("");
      })
      .catch((e) => alive && setRouteLoadError(e?.message || "Could not load the optimized delivery route."))
      .finally(() => alive && setLoadingStops(false));
    return () => { alive = false; };
  }, []);

  const destinationAddresses = useMemo(() => {
    if (explicitDestination.trim()) return [explicitDestination.trim()];
    return stops.map((s) => String(s.dropoff_address || "").trim()).filter(Boolean);
  }, [explicitDestination, stops]);

  const nav = useLokinNavigation({
    destinationAddresses,
    enabled: destinationAddresses.length > 0,
    voiceGuidance,
  });

  const gpsAccuracy = nav.rawPosition?.accuracy_m;
  const providerReady = nav.providerConfigured !== false;

  return (
    <div className={`${locked ? "p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "p-4"} space-y-4 pb-6`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-xl font-bold font-heading metal-text">4D AI GPS</h1>
            <div className="text-[9px] tracking-[0.18em] text-primary/65">PRODUCTION ROAD ENGINE</div>
          </div>
        </div>
        <span className="text-[10px] tracking-[0.18em] text-accent/80 font-display">{locked ? "LOCKED-IN" : "ROAD MATCH · TURNS · RE-ROUTE"}</span>
      </div>

      {!providerReady && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-white">Production routing provider needs a credential</div>
            <div className="mt-1 text-[11px] leading-relaxed text-white/50">The road engine is installed and fail-closed. Add the private <span className="font-mono text-amber-200">MAPBOX_ACCESS_TOKEN</span> secret in Base44 to activate geocoding, traffic-aware road geometry, and turn-by-turn routing.</div>
          </div>
        </div>
      )}

      {locked ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center glow-primary"><Lock className="h-4 w-4 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">Distraction-Free Navigation</div>
            <div className="text-[11px] text-white/45">Real road geometry, next-turn guidance, and automatic off-route recovery stay front and center.</div>
          </div>
          <Link to="/ai-gps?focus=free" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/70">Free roam</Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/45">LOKIN converts delivery addresses into a real drivable street route and snaps your live GPS to it.</p>
          <Link to="/ai-gps?focus=locked" className="shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary">Lock in</Link>
        </div>
      )}

      {(loadingStops || nav.status === "waiting_location" || nav.status === "routing") && destinationAddresses.length > 0 && (
        <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-3 flex items-center gap-3">
          <Satellite className="h-4 w-4 text-accent animate-pulse" />
          <div className="text-xs text-white/60">
            {loadingStops ? "Loading optimized delivery addresses…" : nav.status === "waiting_location" ? "Waiting for precise device GPS…" : "Geocoding stops and building the road-matched route…"}
          </div>
        </div>
      )}

      {(routeLoadError || nav.error) && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-3">
          <div className="flex items-start gap-2 text-sm text-red-300"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{nav.error || routeLoadError}</span></div>
          {nav.rawPosition && destinationAddresses.length > 0 && <button onClick={nav.retry} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70"><RefreshCw className="h-3.5 w-3.5" /> Retry production route</button>}
        </div>
      )}

      {nav.route && (
        <div className="rounded-3xl border border-primary/25 bg-black/70 p-4 shadow-[0_0_35px_-20px_hsl(80_100%_50%)]">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 shrink-0 rounded-2xl border border-primary/35 bg-primary/10 flex items-center justify-center glow-primary"><Navigation className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] tracking-[0.2em] text-primary/70">NEXT MANEUVER</div>
              <div className="mt-1 text-lg font-extrabold leading-tight text-white">{nav.maneuver?.maneuver?.instruction || "Continue on route"}</div>
              <div className="mt-1 text-xs text-white/45 truncate">{nav.maneuver?.road_name || destinationAddresses[0] || "LOKIN road route"}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-display font-black text-primary text-glow">{nav.maneuver?.distance_from_driver_m != null ? formatDistance(nav.maneuver.distance_from_driver_m) : "—"}</div>
              <div className="text-[9px] tracking-wider text-white/35">UNTIL TURN</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <NavMetric label="remaining" value={formatDistance(nav.remainingDistanceM)} />
            <NavMetric label="eta" value={formatDuration(nav.remainingDurationS)} />
            <NavMetric label="gps ±" value={gpsAccuracy != null ? `${Math.round(gpsAccuracy)}m` : "—"} />
            <NavMetric label="reroutes" value={String(nav.rerouteCount)} accent={nav.rerouteCount > 0} />
          </div>
        </div>
      )}

      <div className={locked ? "rounded-[2rem] border border-primary/25 bg-black/70 p-1 shadow-[0_0_40px_-18px_hsl(80_100%_50%)]" : ""}>
        <AiGps4D
          stops={stops}
          routeGeometry={nav.route?.geometry || null}
          snappedPosition={nav.snappedPosition}
          maneuver={nav.maneuver}
          navigationStatus={nav.status}
          remainingDurationS={nav.remainingDurationS}
        />
      </div>

      {!nav.route && !loadingStops && destinationAddresses.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/15 p-6 text-center">
          <RouteIcon className="h-7 w-7 mx-auto text-primary/60" />
          <div className="mt-2 text-sm font-bold text-white/70">No destination is available yet</div>
          <div className="mt-1 text-xs text-white/40">Add eligible offers in Route Optimizer, then start LOKIN Navigation.</div>
          <Link to="/route" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-black"><MapPin className="h-3.5 w-3.5" /> Open Route Optimizer</Link>
        </div>
      )}

      {locked && (
        <>
          <div className="rounded-3xl border border-primary/30 bg-primary/[0.055] p-4 shadow-[0_0_30px_-18px_hsl(80_100%_50%)]">
            <div className="flex items-center gap-3">
              <button onClick={() => setVoiceGuidance((v) => !v)} className="h-12 w-12 shrink-0 rounded-full border border-primary/40 bg-black/60 flex items-center justify-center glow-primary">
                <Volume2 className={`h-5 w-5 ${voiceGuidance ? "text-primary" : "text-white/35"}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] tracking-[0.2em] text-primary/70">LOKIN COPILOT · {nav.status === "navigating" ? "ROAD LOCKED" : nav.status.toUpperCase()}</div>
                <div className="mt-1 text-base font-bold text-white">{voiceGuidance ? "Voice guidance active" : "Voice guidance muted"}</div>
                <div className="mt-0.5 text-[11px] text-white/45">Keep your eyes on the road. LOKIN reroutes only after repeated off-route GPS fixes.</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-primary/25 bg-black/80 p-3 backdrop-blur-xl">
            <div className="mb-2 text-center text-[10px] tracking-[0.2em] text-primary/70">DRIVE CONTROLS · VOICE FIRST</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => dispatchLokinCommand(LOKIN_COMMANDS.ASK, { phrase: "what should I do next" }, "gps-control")} className="min-h-[76px] rounded-2xl bg-primary py-3 text-center text-black active:scale-[0.98]">
                <Mic className="mx-auto h-6 w-6" /><div className="mt-1 text-[10px] font-extrabold">ASK LOKIN</div>
              </button>
              <button onClick={() => dispatchLokinCommand(LOKIN_COMMANDS.PAUSE, {}, "gps-control")} className="min-h-[76px] rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-center text-white/70 active:scale-[0.98]">
                <Pause className="mx-auto h-6 w-6" /><div className="mt-1 text-[10px] font-bold">PAUSE</div>
              </button>
              <button onClick={() => dispatchLokinCommand(LOKIN_COMMANDS.TAP_OUT, {}, "gps-control")} className="min-h-[76px] rounded-2xl border border-red-500/25 bg-red-500/[0.07] py-3 text-center text-red-400 active:scale-[0.98]">
                <Power className="mx-auto h-6 w-6" /><div className="mt-1 text-[10px] font-bold">TAP OUT</div>
              </button>
            </div>
            <div className="mt-2 text-center text-[10px] text-white/35">Enable “Hey LOKIN · App Open” in Voice for wake-word control · Siri shortcuts can launch LOKIN system-wide</div>
          </div>

          <div className="sticky bottom-3 z-20 flex justify-center gap-2">
            {orderId && <Link to={`/compliance-handoff?order=${encodeURIComponent(orderId)}`} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 backdrop-blur px-4 py-2 text-xs font-bold text-primary shadow-lg">Arrived · Verify handoff</Link>}
            <Link to="/ai-gps?focus=free" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/90 backdrop-blur px-4 py-2 text-xs font-semibold text-white/65 shadow-lg">
              <Move className="h-3.5 w-3.5" /> Free roam
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function NavMetric({ label, value, accent = false }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-2">
      <div className={`text-xs font-display font-bold ${accent ? "text-amber-300" : "text-white"}`}>{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-white/35">{label}</div>
    </div>
  );
}
