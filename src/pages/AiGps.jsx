import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, CircleCheck, Crosshair, Lock, MapPin, Mic, Move, Navigation, Pause, Power, Radar, RefreshCw, Route as RouteIcon, Satellite, ShieldCheck, Volume2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SatelliteRoutePreview from "@/components/SatelliteRoutePreview";
import RoadMatchedMap from "@/components/RoadMatchedMap";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import useLokinNavigation from "@/hooks/useLokinNavigation";
import { dispatchLokinCommand, LOKIN_COMMANDS } from "@/lib/lokinCommandBus";
import { formatDistance, formatDuration } from "@/lib/navigationGeometry";
import { loadOptimizedRouteSession } from "@/lib/optimizedRouteSession";

export default function AiGps() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const locked = params.get("focus") === "locked";
  const orderId = params.get("order") || "";
  const explicitDestination = params.get("destination") || "";
  const navigationSession = params.get("nav") === "1";
  const mapSectionRef = useRef(null);
  const [stops, setStops] = useState([]);
  const [routeLoadError, setRouteLoadError] = useState("");
  const [loadingStops, setLoadingStops] = useState(true);
  const [voiceGuidance, setVoiceGuidance] = useState(true);
  const [mapView, setMapView] = useState(() => params.get("view") === "4d" ? "4d" : "real");
  const [destinationInput, setDestinationInput] = useState(explicitDestination);
  const [probingProvider, setProbingProvider] = useState(false);

  useEffect(() => { setDestinationInput(explicitDestination); }, [explicitDestination]);

  useEffect(() => {
    let alive = true;
    setRouteLoadError("");

    if (explicitDestination.trim()) {
      setStops([]);
      setLoadingStops(false);
      return () => { alive = false; };
    }

    const optimizedSession = loadOptimizedRouteSession();
    if (optimizedSession?.stops?.length) {
      setStops(optimizedSession.stops);
      setLoadingStops(false);
      return () => { alive = false; };
    }

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
  }, [explicitDestination]);

  const destinationAddresses = useMemo(() => {
    if (explicitDestination.trim()) return [explicitDestination.trim()];
    return stops.map((s) => String(s.dropoff_address || "").trim()).filter(Boolean);
  }, [explicitDestination, stops]);

  const nav = useLokinNavigation({
    destinationAddresses,
    enabled: destinationAddresses.length > 0,
    voiceGuidance,
  });
  // A nav=1 URL without a resolved destination used to enter the locked GPS
  // surface with no destination field or escape control, which looked frozen.
  // Only activate the locked navigation surface after a real target exists.
  const activeNavigationSession = navigationSession && destinationAddresses.length > 0;

  useEffect(() => {
    if (!activeNavigationSession || !nav.route || !mapSectionRef.current) return;
    const timer = window.setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeNavigationSession, nav.route?.generated_at]);

  const gpsAccuracy = nav.rawPosition?.accuracy_m;
  const providerReady = nav.providerConfigured !== false;

  function setFocusMode(mode) {
    const next = new URLSearchParams(params);
    next.set("focus", mode);
    setParams(next, { replace: true });
  }

  function startDirectNavigation(e) {
    e?.preventDefault?.();
    const destination = destinationInput.trim();
    if (!destination) return;
    const sameDestination = explicitDestination.trim().toLowerCase() === destination.toLowerCase();
    const next = new URLSearchParams(params);
    next.set("focus", "locked");
    next.set("destination", destination);
    next.set("nav", "1");
    next.set("view", "real");
    setMapView("real");
    setParams(next, { replace: true });
    if (sameDestination && nav.rawPosition) nav.retry();
  }

  function useDeliveryRoute() {
    const next = new URLSearchParams(params);
    next.delete("destination");
    setParams(next);
  }

  async function verifyProvider() {
    setProbingProvider(true);
    try { await nav.probeProvider(); }
    finally { setProbingProvider(false); }
  }

  function openAppFreeRoam() {
    const resume = new URLSearchParams(params);
    resume.set("focus", "locked");
    resume.set("nav", "1");
    resume.set("view", mapView || "real");
    const resumeUrl = `/ai-gps?${resume.toString()}`;
    sessionStorage.setItem("lokin_app_free_roam", "1");
    sessionStorage.setItem("lokin_gps_resume_url", resumeUrl);
    navigate("/", { replace: true });
  }

  if (activeNavigationSession) {
    return (
      <LockedGpsSurface
        nav={nav}
        mapView={mapView}
        setMapView={setMapView}
        routeLoadError={routeLoadError}
        loadingStops={loadingStops}
        destinationAddresses={destinationAddresses}
        onOpenAppFreeRoam={openAppFreeRoam}
        onExit={() => navigate("/", { replace: true })}
      />
    );
  }

  return (
    <div className={`${locked ? "p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "p-4"} relative isolate space-y-4 overflow-hidden pb-6`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-[1]">
        <div className="absolute -left-1/4 top-20 h-56 w-[150%] -rotate-[18deg] bg-gradient-to-r from-transparent via-[#8FE44E]/[0.06] to-transparent" />
        <div className="absolute -left-1/4 top-[480px] h-40 w-[150%] -rotate-[18deg] bg-gradient-to-r from-transparent via-[#8FE44E]/[0.05] to-transparent" />
        <div className="absolute -left-1/4 top-[860px] h-48 w-[150%] -rotate-[18deg] bg-gradient-to-r from-transparent via-[#8FE44E]/[0.04] to-transparent" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 200deg, #f4f4f4, #8a8a8a 25%, #e6e6e6 50%, #5f5f5f 75%, #f4f4f4)" }} />
            <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-[#0a0f0a]">
              <MapPin className="h-6 w-6 text-[#8FE44E] drop-shadow-[0_0_8px_rgba(143,228,78,0.9)]" />
            </div>
          </div>
          <div>
            <h1 className="font-display text-[28px] font-black italic leading-none tracking-tight">
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(180deg,#FFFFFF 0%,#9A9A9A 38%,#E8E8E8 55%,#6E6E6E 100%)" }}>4D AI </span>
              <span className="text-[#8FE44E] drop-shadow-[0_0_12px_rgba(143,228,78,0.55)]">GPS</span>
            </h1>
            <div className="mt-1.5 text-[9px] font-semibold tracking-[0.42em] text-white/45">PRODUCTION ROAD ENGINE</div>
          </div>
        </div>
        {locked ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded-full border border-[#8FE44E]/70 bg-black/70 px-4 py-1.5 font-display text-[11px] font-extrabold tracking-[0.18em] text-[#8FE44E] shadow-[0_0_14px_rgba(143,228,78,0.35)]">● LOCKED-IN</span>
            <span className="text-right text-[8px] font-semibold leading-relaxed tracking-[0.34em] text-white/40">DRIVE SMARTER<br />GO FURTHER</span>
          </div>
        ) : (
          <span className="lokin-kicker lokin-kicker-cyan font-display">ROAD MATCH · TURNS · RE-ROUTE</span>
        )}
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

      {!activeNavigationSession && nav.providerConfigured === true && (
        <div className="rounded-[20px] border border-[#8FE44E]/50 bg-[#0a0f0a]/90 p-4 shadow-[0_0_18px_rgba(143,228,78,0.18)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ShieldCheck className={`h-9 w-9 shrink-0 ${nav.providerVerified === true ? "text-[#8FE44E]" : "text-[#8FE44E]"} drop-shadow-[0_0_10px_rgba(143,228,78,0.7)]`} />
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-white">{nav.providerVerified === true && nav.liveVectorConfigured === true ? "Mapbox live vector GPS verified" : nav.providerVerified === true ? "Mapbox routing verified" : "Mapbox secret detected"}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-white/45">{nav.providerVerified === true && nav.liveVectorConfigured === true ? "Routing, search, and the persistent GPU map are ready." : nav.providerVerified === true ? "Routing works; add MAPBOX_PUBLIC_TOKEN to activate the live vector map." : "Run one provider check before the road test."}</div>
              </div>
            </div>
            <button onClick={verifyProvider} disabled={probingProvider} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#8FE44E]/70 bg-transparent px-4 py-2.5 text-[11px] font-extrabold tracking-[0.08em] text-[#8FE44E] shadow-[0_0_12px_rgba(143,228,78,0.25)] disabled:opacity-50 active:scale-95">
              {probingProvider ? "CHECKING…" : nav.providerVerified === true ? "RECHECK" : "VERIFY MAPBOX"} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {nav.providerProbeError && <div className="mt-2 text-[10px] text-red-300">{nav.providerProbeError}</div>}
        </div>
      )}

      {!activeNavigationSession && (locked ? (
        <div className="overflow-hidden rounded-[20px] border border-[#8FE44E]/50 bg-[#0a0f0a]/90 shadow-[0_0_22px_rgba(143,228,78,0.2)]">
          <div className="flex">
            <div className="relative min-h-[196px] w-[38%] shrink-0 overflow-hidden">
              <svg viewBox="0 0 120 196" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
                <g fill="none" stroke="#8FE44E">
                  <ellipse cx="60" cy="160" rx="54" ry="30" strokeOpacity="0.28" strokeWidth="1.5" />
                  <ellipse cx="60" cy="160" rx="42" ry="23" strokeOpacity="0.24" strokeWidth="1.5" />
                  <ellipse cx="60" cy="160" rx="30" ry="16" strokeOpacity="0.22" strokeWidth="1.5" />
                  <ellipse cx="60" cy="160" rx="18" ry="10" strokeOpacity="0.2" strokeWidth="1.5" />
                  <path d="M8 44 Q42 62 32 104 T62 168" strokeOpacity="0.16" strokeWidth="1.5" />
                  <path d="M104 30 Q82 72 98 122 T72 176" strokeOpacity="0.16" strokeWidth="1.5" />
                  <path d="M-4 178 C 26 164, 38 152, 48 140 S 74 118, 62 98" strokeWidth="4" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 7px rgba(143,228,78,0.95))" }} />
                </g>
              </svg>
              <MapPin className="absolute left-1/2 top-[36%] h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-[#8FE44E] drop-shadow-[0_0_14px_rgba(143,228,78,1)]" fill="rgba(143,228,78,0.25)" />
            </div>
            <div className="min-w-0 flex-1 p-4">
              <div className="text-[15px] font-bold text-white">Distraction-Free</div>
              <div className="text-[27px] font-black leading-tight text-[#8FE44E] drop-shadow-[0_0_10px_rgba(143,228,78,0.45)]">Navigation</div>
              <div className="mt-1 text-[11px] leading-relaxed text-white/45">Real road geometry, next-turn guidance, and automatic off-route recovery stay front and center.</div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => setFocusMode("free")} className="inline-flex items-center gap-1 rounded-full border border-[#8FE44E]/70 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_0_10px_rgba(143,228,78,0.2)] active:scale-95">Free roam <ChevronRight className="h-4 w-4 text-[#8FE44E]" /></button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 pb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#8FE44E]/60" />
            <div className="text-[9px] font-semibold tracking-[0.4em] text-white/50">FOCUS&nbsp;&nbsp;DRIVES&nbsp;&nbsp;PROGRESS</div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#8FE44E]/60" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/45">LOKIN converts delivery addresses into a real drivable street route and snaps your live GPS to it.</p>
          <button type="button" onClick={() => setFocusMode("locked")} className="shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary active:scale-95">Follow driver</button>
        </div>
      ))}

      {!activeNavigationSession && <form onSubmit={startDirectNavigation} className="rounded-[20px] border border-cyan-400/50 bg-[#070b0d]/90 p-4 shadow-[0_0_20px_rgba(6,217,249,0.18)]">
        <div className="mb-3 flex items-start gap-3">
          <Crosshair className="h-8 w-8 shrink-0 text-cyan-300 drop-shadow-[0_0_10px_rgba(6,217,249,0.8)]" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-extrabold tracking-[0.14em] text-[#8FE44E]">LIVE ROAD TEST</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-white/45">Type a store, business, place, or address—or say “Hey LOKIN, navigate to Walmart.”</div>
          </div>
          {explicitDestination && <button type="button" onClick={useDeliveryRoute} className="shrink-0 text-[10px] font-semibold text-white/45">Use delivery route</button>}
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/15 bg-black/70 px-3">
            <MapPin className="h-5 w-5 shrink-0 text-white/70" />
            <input value={destinationInput} onChange={(e) => setDestinationInput(e.target.value)} placeholder="Store, business, place, or address" className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] text-white outline-none placeholder:text-white/30" />
          </div>
          <button type="submit" disabled={!destinationInput.trim()} className="inline-flex items-center gap-1 rounded-2xl bg-[#8FE44E] px-5 text-[15px] font-black text-black shadow-[0_0_16px_rgba(143,228,78,0.45)] disabled:opacity-40 active:scale-95">FIND + GO <ChevronRight className="h-5 w-5" /></button>
        </div>
        {explicitDestination && <div className="mt-2 truncate text-[10px] text-cyan-200/70">ACTIVE DESTINATION · {explicitDestination}</div>}
      </form>}

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
        <div className="lokin-card p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 shrink-0 rounded-2xl border border-primary/35 bg-primary/10 flex items-center justify-center glow-primary"><Navigation className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <div className="lokin-kicker lokin-kicker-lime">NEXT MANEUVER</div>
              <div className="mt-1 text-lg font-extrabold leading-tight text-white">{nav.maneuver?.maneuver?.instruction || "Continue on route"}</div>
              <div className="mt-1 text-xs text-white/45 truncate">{nav.maneuver?.road_name || destinationAddresses[0] || "LOKIN road route"}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="lokin-hero-number font-display text-xl">{nav.maneuver?.distance_from_driver_m != null ? formatDistance(nav.maneuver.distance_from_driver_m) : "—"}</div>
              <div className="lokin-kicker mt-1">UNTIL TURN</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <NavMetric label="remaining" value={formatDistance(nav.remainingDistanceM)} />
            <NavMetric label="eta" value={formatDuration(nav.remainingDurationS)} />
            <NavMetric label="gps ±" value={gpsAccuracy != null ? `${Math.round(gpsAccuracy)}m` : "—"} />
            <NavMetric label="reroutes" value={String(nav.rerouteCount)} accent={nav.rerouteCount > 0} />
          </div>
          {nav.geocodedDestinations?.[0]?.full_address && (
            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] text-white/45">
              <span className="font-semibold text-primary/75">RESOLVED DESTINATION · </span>
              {nav.geocodedDestinations[0].name && nav.geocodedDestinations[0].name !== nav.geocodedDestinations[0].full_address
                ? `${nav.geocodedDestinations[0].name} · `
                : ""}
              {nav.geocodedDestinations[0].full_address}
            </div>
          )}
        </div>
      )}

      {nav.route ? (
        <div ref={mapSectionRef} id="lokin-gps-map" className="space-y-2 scroll-mt-4">
          <div className="mx-auto flex w-fit gap-1 rounded-full border border-lokin-neon/30 bg-black/85 p-1">
            <button type="button" onClick={() => setMapView("real")} className={`rounded-full px-4 py-2 text-[10px] font-extrabold tracking-[0.12em] ${mapView === "real" ? "bg-primary text-black" : "text-white/55"}`}>REAL MAP</button>
            <button type="button" onClick={() => setMapView("4d")} className={`rounded-full px-4 py-2 text-[10px] font-extrabold tracking-[0.12em] ${mapView === "4d" ? "bg-accent text-black" : "text-white/55"}`}>REAL 4D</button>
          </div>
          {mapView === "real" ? (
            <RoadMatchedMap
              routeGeometry={nav.route.geometry}
              snappedPosition={nav.snappedPosition}
              maneuver={nav.maneuver}
              remainingDurationS={nav.remainingDurationS}
              followDriver={locked}
              navigationStatus={nav.status}
            />
          ) : (
            <RoadMatchedMap
              routeGeometry={nav.route.geometry}
              snappedPosition={nav.snappedPosition}
              maneuver={nav.maneuver}
              remainingDurationS={nav.remainingDurationS}
              followDriver={locked}
              perspective
              navigationStatus={nav.status}
            />
          )}
        </div>
      ) : (
        <SatelliteRoutePreview stops={stops} destinationAddress={explicitDestination} />
      )}

      {!nav.route && !loadingStops && destinationAddresses.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-[#8FE44E]/40 bg-black/60 p-6 text-center shadow-[0_0_18px_rgba(143,228,78,0.12)]">
          <RouteIcon className="mx-auto h-10 w-10 text-[#8FE44E] drop-shadow-[0_0_10px_rgba(143,228,78,0.8)]" />
          <div className="mt-3 text-[17px] font-bold text-white">No destination is available yet</div>
          <div className="mt-1 text-[13px] text-white/45">Add eligible offers in Route Optimizer, then start LOKIN Navigation.</div>
          <Link to="/route" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#8FE44E] px-6 py-3.5 text-[15px] font-bold text-black shadow-[0_0_16px_rgba(143,228,78,0.45)] active:scale-95"><MapPin className="h-4 w-4" /> Open Route Optimizer <ChevronRight className="h-5 w-5" /></Link>
        </div>
      )}

      {locked && (
        <>
          <div className="rounded-[20px] border border-[#8FE44E]/50 bg-[#0a0f0a]/90 p-4 shadow-[0_0_20px_rgba(143,228,78,0.2)]">
            <div className="flex items-center gap-4">
              <button onClick={() => setVoiceGuidance((v) => !v)} aria-label="Toggle voice guidance" className="relative h-16 w-16 shrink-0 active:scale-95">
                <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 200deg, #f4f4f4, #8a8a8a 25%, #e6e6e6 50%, #5f5f5f 75%, #f4f4f4)" }} />
                <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-[#0a0f0a] shadow-[0_0_14px_rgba(143,228,78,0.5)]">
                  <Volume2 className={`h-6 w-6 ${voiceGuidance ? "text-[#8FE44E]" : "text-white/35"}`} />
                </div>
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-semibold tracking-[0.4em] text-white/45">LOKIN COPILOT · <span className="text-[#8FE44E]">{nav.status === "navigating" ? "ROAD LOCKED" : nav.status.toUpperCase()}</span></div>
                <div className="mt-1.5 text-[17px] font-bold text-white">{voiceGuidance ? "Voice guidance active" : "Voice guidance muted"}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-white/45">Keep your eyes on the road. LOKIN reroutes only after repeated off-route GPS fixes.</div>
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

          <div className="flex justify-center gap-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {orderId && <Link to={`/compliance-handoff?order=${encodeURIComponent(orderId)}`} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-xs font-bold text-primary shadow-lg">Arrived · Verify handoff</Link>}
            <button type="button" onClick={() => setFocusMode("free")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/90 px-4 py-2 text-xs font-semibold text-white/65 shadow-lg active:scale-95">
              <Move className="h-3.5 w-3.5" /> Free roam
            </button>
          </div>
        </>
      )}

      <div className="flex items-center gap-4 pt-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#8FE44E]/70" />
        <div className="text-[9px] font-semibold tracking-[0.5em] text-white/40">UNLOCK YOUR POTENTIAL</div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#8FE44E]/70" />
      </div>
    </div>
  );
}

function LockedGpsSurface({ nav, mapView, setMapView, routeLoadError, loadingStops, destinationAddresses, onOpenAppFreeRoam, onExit }) {
  const error = nav.error || routeLoadError;
  const waiting = loadingStops || nav.status === "waiting_location" || nav.status === "routing" || nav.status === "rerouting";

  return (
    <div className="fixed left-0 top-0 z-20 box-border h-[100dvh] w-screen max-w-[100vw] min-w-0 overflow-hidden overscroll-none bg-black text-white">
      {nav.route ? (
        <RoadMatchedMap
          routeGeometry={nav.route.geometry}
          snappedPosition={nav.snappedPosition}
          maneuver={nav.maneuver}
          remainingDurationS={nav.remainingDurationS}
          followDriver
          perspective={mapView === "4d"}
          fullscreen
          etaLiveTraffic={nav.etaLiveTraffic}
          navigationStatus={nav.status}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#081008] px-8 text-center">
          <div>
            <Radar className="mx-auto h-10 w-10 animate-pulse text-primary" />
            <div className="mt-4 font-display text-lg font-black tracking-[0.16em] text-primary">LOKIN GPS</div>
            <div className="mt-2 text-sm text-white/55">
              {error ? "Navigation needs attention" : waiting ? "Locking onto your live road route…" : "Waiting for a destination…"}
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 box-border grid min-w-0 grid-cols-[auto_minmax(44px,1fr)_auto_auto] items-center gap-1.5 overflow-hidden px-[max(0.55rem,env(safe-area-inset-left))] pt-[calc(0.5rem+env(safe-area-inset-top))] [padding-right:max(0.55rem,env(safe-area-inset-right))]">
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-lokin-neon/50 bg-black/85 px-2.5 text-[10px] font-extrabold tracking-[0.02em] text-lokin-neon shadow-lg active:scale-95"
          aria-label="Back to LOKIN home"
        >
          ‹<span className="hidden min-[390px]:inline"> BACK</span>
        </button>

        <div className="pointer-events-auto min-w-0 truncate rounded-full border border-accent/50 bg-black/72 px-2.5 py-2 text-[8px] font-extrabold tracking-[0.04em] text-accent glow-cyan backdrop-blur">
          ● <span className="hidden min-[410px]:inline">HEY </span>LOKIN
        </div>

        {nav.route ? (
          <div className="pointer-events-auto flex shrink-0 rounded-full border border-lokin-neon/30 bg-black/78 p-0.5 shadow-lg backdrop-blur">
            <button type="button" onClick={() => dispatchLokinCommand(LOKIN_COMMANDS.ASK, { phrase: "what should I do next" }, "gps-view")} aria-label="Ask LOKIN" className="min-w-[42px] rounded-full px-2 py-2 text-[8px] font-extrabold tracking-[0.04em] text-primary active:scale-95">LOKIN</button>
            <button type="button" onClick={() => setMapView("real")} className={`min-w-[42px] rounded-full px-2 py-2 text-[8px] font-extrabold tracking-[0.04em] ${mapView === "real" ? "bg-primary text-black" : "text-white/55"}`}>MAP</button>
            <button type="button" onClick={() => setMapView("4d")} className={`min-w-[38px] rounded-full px-2 py-2 text-[8px] font-extrabold tracking-[0.04em] ${mapView === "4d" ? "bg-accent text-black" : "text-white/55"}`}>4D</button>
          </div>
        ) : <span />}

        {nav.route ? (
          <button
            type="button"
            onClick={onOpenAppFreeRoam}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/72 text-white/65 shadow-md backdrop-blur active:scale-95"
            aria-label="Free roam"
          >
            <Move className="h-4 w-4" />
          </button>
        ) : <span className="w-10" />}
      </div>

      {error && !nav.route && (
        <div className="absolute inset-x-4 top-1/2 z-40 -translate-y-1/2 rounded-3xl border border-red-500/30 bg-black/90 p-5 text-center backdrop-blur">
          <AlertTriangle className="mx-auto h-6 w-6 text-red-300" />
          <div className="mt-2 text-sm font-bold text-red-200">{error}</div>
          {nav.rawPosition && destinationAddresses.length > 0 && (
            <button onClick={nav.retry} className="mt-4 rounded-2xl bg-primary px-5 py-3 text-xs font-extrabold text-black">RETRY GPS</button>
          )}
        </div>
      )}
    </div>
  );
}

function NavMetric({ label, value, accent = false }) {
  return (
    <div className="lokin-stat-tile">
      <div className={`text-xs font-display ${accent ? "font-bold text-amber-300" : "lokin-stat-value"}`}>{value}</div>
      <div className="lokin-kicker mt-1">{label}</div>
    </div>
  );
}