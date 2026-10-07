import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, CircleCheck, CircleDot, CornerUpLeft, CornerUpRight, Flag, Lock, MapPin, Merge, Mic, Move, Navigation, PackageSearch, Pause, Power, Radar, RefreshCw, RotateCw, Route as RouteIcon, Satellite, Search, Split, Undo2, Volume2, VolumeX } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SatelliteRoutePreview from "@/components/SatelliteRoutePreview";
import RoadMatchedMap from "@/components/RoadMatchedMap";
import { LOKIN_CENTER, LOKIN_SKYLINE_BG } from "@/components/Brand";
import RouteImprovementAlert from "@/components/nav/RouteImprovementAlert";
import { speakGuidance, unlockVoiceAudio } from "@/lib/lokinVoicePipeline";
import VoicePicker from "@/components/VoicePicker";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import useLokinNavigation from "@/hooks/useLokinNavigation";
import { dispatchLokinCommand, LOKIN_COMMANDS } from "@/lib/lokinCommandBus";
import { formatDistance, formatDuration } from "@/lib/navigationGeometry";
import { loadOptimizedRouteSession } from "@/lib/optimizedRouteSession";
import { saveSessionRouteRecord } from "@/lib/sessionRouteRecord";
import useRouteImprovementPush from "@/hooks/useRouteImprovementPush";
import useNavHaptics from "@/hooks/useNavHaptics";
import HudItemLocator from "@/components/vision/HudItemLocator";
import GpsQuickSearch from "@/components/gps/GpsQuickSearch";
import DestinationHours from "@/components/gps/DestinationHours";
import Speedometer from "@/components/gps/Speedometer";

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
  // Guidance-audio health: gateway TTS is the only voice that works inside
  // the iOS web view. On gateway failure the pipeline emits "guidance-error"
  // (the device fallback is silent there) — the speaker button goes amber
  // until a prompt plays through cleanly ("idle"). Never fails silently
  // with the toggle showing ON (2026-09-29).
  const [guidanceAudioError, setGuidanceAudioError] = useState(false);

  useEffect(() => {
    const onVoiceState = (e) => {
      const st = e?.detail?.state;
      if (st === "guidance-error") setGuidanceAudioError(true);
      else if (st === "idle") setGuidanceAudioError(false);
    };
    window.addEventListener("lokin:voice-state", onVoiceState);
    return () => window.removeEventListener("lokin:voice-state", onVoiceState);
  }, []);
  const [mapView, setMapView] = useState(() => params.get("view") === "4d" ? "4d" : "real");
  // Cinematic action mode (locked art direction 2026-09-25): dusk grade,
  // terrain, orbit camera, FPS meter. Separate from the 4D perspective view.
  const [cinematic, setCinematic] = useState(false);
  const [destinationInput, setDestinationInput] = useState(explicitDestination);
  const [probingProvider, setProbingProvider] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => { setDestinationInput(explicitDestination); }, [explicitDestination]);

  useEffect(() => {
    setRouteLoadError("");

    if (explicitDestination.trim()) {
      setStops([]);
      setLoadingStops(false);
      return;
    }

    const optimizedSession = loadOptimizedRouteSession();
    if (optimizedSession?.stops?.length) {
      setStops(optimizedSession.stops);
      setLoadingStops(false);
      return;
    }

    // Opening GPS must not implicitly optimize offers or block destination search.
    setStops([]);
    setLoadingStops(false);
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
  // True when the final routed destination resolved from the driver's own saved door pin.
  const arrivedAtDoorPin = (nav.geocodedDestinations || []).some((g) => g?.door_pin === true);

  // Instant faster-route alerts: web notification + native push (one per detection).
  useRouteImprovementPush(nav.routeImprovement);

  // Haptic turn approach: escalating vibration as each upcoming maneuver nears
  // (400 m tap → 200 m double → 90 m strong → 25 m at the street/exit).
  useNavHaptics(nav.maneuver);

  // Voice-announce faster-route finds so the driver never has to check the map.
  useEffect(() => {
    if (!nav.routeImprovement || !voiceGuidance) return;
    const mins = Math.max(1, Math.round(nav.routeImprovement.savings_s / 60));
    speakGuidance(`Faster route available. You can save about ${mins} minutes.`);
  }, [nav.routeImprovement?.received_at_ms, voiceGuidance]);

  // Active delivery points in the already-optimized sequence, for the 3D map's
  // clustered stop layer (1 → N fastest, fuel-saving order).
  const deliveryStops = useMemo(() => {
    return (nav.geocodedDestinations || [])
      .map((g, i) => ({
        sequence: i + 1,
        coordinate: [Number(g.longitude), Number(g.latitude)],
        // Rooftop/parcel point for the visual beam; falls back to the routable
        // coordinate when the geocoder had no raw geometry (e.g. door pins).
        rooftop_coordinate:
          Number.isFinite(Number(g.rooftop_longitude)) && Number.isFinite(Number(g.rooftop_latitude))
            ? [Number(g.rooftop_longitude), Number(g.rooftop_latitude)]
            : null,
        input: g.input || "",
        full_address: g.full_address || "",
      }))
      .filter((s) => Number.isFinite(s.coordinate[0]) && Number.isFinite(s.coordinate[1]));
  }, [nav.geocodedDestinations]);

  // Persist the AI-optimized route while navigating so the end-of-session
  // Shift Recap can draw the efficiency map (driven path vs planned route).
  useEffect(() => {
    if (nav.route) saveSessionRouteRecord({ geometry: nav.route.geometry, stops: deliveryStops });
  }, [nav.route?.generated_at, deliveryStops]);
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
    next.set("view", mapView);
    // Preserve the selected MAP/4D mode on Find + Go.
    setParams(next, { replace: true });
    if (sameDestination && nav.rawPosition) nav.retry();
  }

  function useDeliveryRoute() {
    const next = new URLSearchParams(params);
    next.delete("destination");
    setParams(next);
  }

  // Quick search (locked GPS): re-point live navigation at the picked place.
  function navigateToSearchedDestination(destination) {
    if (!destination) return;
    const next = new URLSearchParams(params);
    next.set("focus", "locked");
    next.set("destination", destination);
    next.set("nav", "1");
    next.set("view", mapView);
    setParams(next, { replace: true });
    setSearchOpen(false);
  }

  async function loadDeliveryRoute() {
    if (loadingStops) return;
    setLoadingStops(true);
    setRouteLoadError("");
    try {
      const res = await guardedInvoke(base44, "optimizeRoute", { mode: "most_profit" }, { force: true, userInitiated: true });
      const nextStops = Array.isArray(res.data?.sequenced) ? res.data.sequenced : [];
      if (!nextStops.length) {
        setStops([]);
        setRouteLoadError("No eligible delivery stops are available. Add confirmed offers in Route Optimizer, or use Find + Go.");
        return;
      }
      setStops(nextStops);
    } catch (e) {
      setRouteLoadError(e?.message || "Could not load the optimized delivery route.");
    } finally {
      setLoadingStops(false);
    }
  }

  async function verifyProvider() {
    setProbingProvider(true);
    try { await nav.probeProvider(); }
    finally { setProbingProvider(false); }
  }

  function enterFullscreenNavigation() {
    const next = new URLSearchParams(params);
    next.set("focus", "locked");
    next.set("nav", "1");
    setParams(next, { replace: true });
  }

  if (activeNavigationSession) {
    return (
      <LockedGpsSurface
        nav={nav}
        mapView={mapView}
        setMapView={setMapView}
        cinematic={cinematic}
        setCinematic={setCinematic}
        routeLoadError={routeLoadError}
        loadingStops={loadingStops}
        deliveryStops={deliveryStops}
        destinationAddresses={destinationAddresses}
        doorPinArrived={arrivedAtDoorPin}
        voiceGuidance={voiceGuidance}
        setVoiceGuidance={setVoiceGuidance}
        guidanceAudioError={guidanceAudioError}
        onExit={() => navigate("/", { replace: true })}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        onQuickSearch={navigateToSearchedDestination}
      />
    );
  }

  return (
    <div
      className={`${locked ? "p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "p-4"} space-y-4 pb-6`}
      style={{
        backgroundImage: `linear-gradient(rgba(3, 9, 8, 0.84), rgba(2, 5, 4, 0.92)), url(${LOKIN_SKYLINE_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-accent" />
          <div>
            <h1 className="lokin-wordmark text-xl font-bold font-heading leading-none tracking-[0.04em]">4D AI GPS</h1>
            <div className="lokin-kicker lokin-kicker-lime mt-1">PRODUCTION ROAD ENGINE</div>
          </div>
        </div>
        {locked ? (
          <span className="rounded-full border border-lokin-neon/60 bg-black/70 px-3 py-1 font-display text-[10px] font-extrabold tracking-[0.18em] text-primary glow-primary">● LOCKED-IN</span>
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

      {/* Provider QA card (VERIFY MAPBOX) is a dev/build-time diagnostic. It must
          never ship in a production App Store build — gated off via import.meta.env.PROD. */}
      {!import.meta.env.PROD && !activeNavigationSession && nav.providerConfigured === true && (
        <div className={`lokin-card p-3 ${nav.providerVerified === true ? "border-primary/60 bg-primary/[0.06]" : "bg-white/[0.025]"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CircleCheck className={`h-4 w-4 shrink-0 ${nav.providerVerified === true ? "text-primary" : "text-white/45"}`} />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">{nav.providerVerified === true && nav.liveVectorConfigured === true ? "Mapbox live vector GPS verified" : nav.providerVerified === true ? "Mapbox routing verified" : "Mapbox secret detected"}</div>
                <div className="text-[10px] text-white/40">{nav.providerVerified === true && nav.liveVectorConfigured === true ? "Routing, search, and the persistent GPU map are ready." : nav.providerVerified === true ? "Routing works; add MAPBOX_PUBLIC_TOKEN to activate the live vector map." : "Run one provider check before the road test."}</div>
              </div>
            </div>
            <button onClick={verifyProvider} disabled={probingProvider} className="shrink-0 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[10px] font-bold text-primary disabled:opacity-50">
              {probingProvider ? "CHECKING…" : nav.providerVerified === true ? "RECHECK" : "VERIFY MAPBOX"}
            </button>
          </div>
          {nav.providerProbeError && <div className="mt-2 text-[10px] text-red-300">{nav.providerProbeError}</div>}
        </div>
      )}

      {!activeNavigationSession && (locked ? (
        <div className="lokin-card p-3 flex items-center gap-3 border-primary/60">
          <div className="h-9 w-9 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center glow-primary"><Lock className="h-4 w-4 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">Distraction-Free Navigation</div>
            <div className="text-[11px] text-white/45">Real road geometry, next-turn guidance, and automatic off-route recovery stay front and center.</div>
          </div>
          <button type="button" onClick={() => setFocusMode("free")} className="lokin-ghost !py-2 !px-3 !text-[11px] active:scale-95">Free roam</button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/45">LOKIN converts delivery addresses into a real drivable street route and snaps your live GPS to it.</p>
          <button type="button" onClick={() => setFocusMode("locked")} className="shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary active:scale-95">Follow driver</button>
        </div>
      ))}

      {!activeNavigationSession && <form onSubmit={startDirectNavigation} className="lokin-card-cyan p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="lokin-kicker lokin-kicker-cyan font-display">LIVE ROAD TEST</div>
            <div className="text-[10px] text-white/35">Type a store, business, place, or address—or say “Hey LOKIN, navigate to Walmart.”</div>
          </div>
          {explicitDestination && <button type="button" onClick={useDeliveryRoute} className="text-[10px] font-semibold text-white/45">Use delivery route</button>}
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-accent/25 bg-black/70 px-3">
            <MapPin className="h-4 w-4 shrink-0 text-accent" />
            <input value={destinationInput} onChange={(e) => setDestinationInput(e.target.value)} placeholder="Store, business, place, or address" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/25" />
          </div>
          <button type="submit" disabled={!destinationInput.trim()} className="lokin-cta lokin-cta-sm font-extrabold">FIND + GO</button>
        </div>
        {explicitDestination && <div className="mt-2 truncate text-[10px] text-accent/70">ACTIVE DESTINATION · {explicitDestination}</div>}
      </form>}

      {(loadingStops || nav.status === "waiting_location" || nav.status === "routing") && destinationAddresses.length > 0 && (
        <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-3 flex items-center gap-3">
          <Satellite className="h-4 w-4 text-accent animate-pulse" />
          <div className="text-xs text-white/60">
            {loadingStops ? "Loading optimized delivery addresses…" : nav.status === "waiting_location" ? (nav.waitingDetail || "Waiting for precise device GPS…") : "Geocoding stops and building the road-matched route…"}
          </div>
          {nav.status === "waiting_location" && nav.waitingDetail && !loadingStops && (
            <button onClick={nav.restartLocation} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70"><RefreshCw className="h-3.5 w-3.5" /> RETRY GPS</button>
          )}
        </div>
      )}

      {nav.offlineRoute && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-white">Offline cached route</div>
            <div className="mt-1 text-[11px] leading-relaxed text-white/50">The route service is unreachable, so LOKIN is navigating from your automatically saved route data. Turn guidance, ETA, and arrival detection continue on-device.</div>
          </div>
        </div>
      )}

      <RouteImprovementAlert improvement={nav.routeImprovement} onApply={nav.applyRouteImprovement} onDismiss={nav.dismissRouteImprovement} />

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
              <div className="mt-1 text-xs text-white/45 truncate">{nav.maneuver?.road_name || nav.maneuver?.destinations || destinationAddresses[0] || "LOKIN road route"}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="lokin-hero-number font-display text-xl">{nav.maneuver?.distance_from_driver_m != null ? formatDistance(nav.maneuver.distance_from_driver_m) : "—"}</div>
              <div className="lokin-kicker mt-1">UNTIL TURN</div>
            </div>
          </div>
          <Speedometer
            speedMps={nav.rawPosition?.speed_mps}
            latitude={nav.rawPosition?.latitude}
            longitude={nav.rawPosition?.longitude}
            heading={nav.rawPosition?.heading}
          />
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
            <button type="button" onClick={() => { setMapView("4d"); setCinematic(false); }} className={`rounded-full px-4 py-2 text-[10px] font-extrabold tracking-[0.12em] ${mapView === "4d" ? "bg-accent text-black" : "text-white/55"}`}>REAL 4D</button>
          </div>
          {deliveryStops.length > 1 && (
            <div className="text-center text-[9px] font-extrabold tracking-[0.14em] text-primary/80">
              ● PINNED {deliveryStops.length} STOPS · NUMBERED 1–{deliveryStops.length} IN YOUR FASTEST, FUEL-SAVING ORDER · ZOOM OUT TO CLUSTER
            </div>
          )}
          {mapView === "real" ? (
            <RoadMatchedMap
              routeGeometry={nav.route.geometry}
              deliveryStops={deliveryStops}
              snappedPosition={nav.snappedPosition}
              maneuver={nav.maneuver}
              remainingDurationS={nav.remainingDurationS}
              followDriver={locked}
              navigationStatus={nav.status}
              destinationSide={nav.route?.destination_side}
              doorPinArrived={arrivedAtDoorPin}
              onEnterFullscreen={enterFullscreenNavigation}
            />
          ) : (
            <RoadMatchedMap
              routeGeometry={nav.route.geometry}
              deliveryStops={deliveryStops}
              snappedPosition={nav.snappedPosition}
              maneuver={nav.maneuver}
              remainingDurationS={nav.remainingDurationS}
              followDriver={locked}
              perspective
              navigationStatus={nav.status}
              destinationSide={nav.route?.destination_side}
              doorPinArrived={arrivedAtDoorPin}
              onEnterFullscreen={enterFullscreenNavigation}
            />
          )}
        </div>
      ) : (
        <SatelliteRoutePreview stops={stops} destinationAddress={explicitDestination} />
      )}

      {!nav.route && !loadingStops && destinationAddresses.length === 0 && (
        <div className="rounded-3xl border border-dashed border-lokin-neon/45 bg-black/60 p-6 text-center shadow-[0_0_18px_rgba(51,255,20,0.12)]">
          <RouteIcon className="h-7 w-7 mx-auto text-primary/60" />
          <div className="mt-2 text-sm font-bold text-white/70">No destination is available yet</div>
          <div className="mt-1 text-xs text-white/40">Use Find + Go above for any destination, or load your eligible delivery stops when you choose.</div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={loadDeliveryRoute} disabled={loadingStops} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50"><RouteIcon className="h-3.5 w-3.5" /> {loadingStops ? "Loading route…" : "Load delivery route"}</button>
            <Link to="/route" className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2.5 text-xs font-bold text-primary"><MapPin className="h-3.5 w-3.5" /> Route Optimizer</Link>
          </div>
        </div>
      )}

      {locked && (
        <>
          <div className="lokin-card p-4 border-accent/40">
            <div className="flex items-center gap-3">
              <button onClick={() => { unlockVoiceAudio(); setVoiceGuidance((v) => !v); }} title={guidanceAudioError ? "Guidance audio had an issue — the next prompt will retry" : undefined} className={`h-12 w-12 shrink-0 rounded-full border ${guidanceAudioError ? "border-amber-400/70" : "border-accent/40"} bg-black/60 flex items-center justify-center ${guidanceAudioError ? "" : "glow-cyan"}`}>
                <Volume2 className={`h-5 w-5 ${guidanceAudioError ? "text-amber-400" : voiceGuidance ? "text-accent" : "text-white/35"}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="lokin-kicker lokin-kicker-cyan">LOKIN COPILOT · {nav.status === "navigating" ? "ROAD LOCKED" : nav.status.toUpperCase()}</div>
                <div className="mt-1 text-base font-bold text-white">{guidanceAudioError ? "Guidance audio issue — retrying" : voiceGuidance ? "Voice guidance active" : "Voice guidance muted"}</div>
                <div className="mt-0.5 text-[11px] text-white/45">Keep your eyes on the road. LOKIN reroutes only after repeated off-route GPS fixes.</div>
              </div>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="lokin-kicker mb-2">Guidance voice</div>
              <VoicePicker compact voiceKind="guidance" />
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
    </div>
  );
}

// Turn-arrow icon for the maneuver banner, mapped from the Mapbox maneuver
// type/modifier (2026-09-29 HUD cleanup, Google Maps reference layout).
function maneuverTurnIcon(m) {
  const type = String(m?.maneuver?.type || "").toLowerCase();
  const mod = String(m?.maneuver?.modifier || "").toLowerCase();
  if (type === "arrive") return Flag;
  if (type === "depart") return CircleDot;
  if (mod === "uturn") return Undo2;
  if (type.includes("roundabout") || type.includes("rotary")) return RotateCw;
  if (type === "merge") return Merge;
  if (type === "fork") return Split;
  if (mod.includes("sharp right")) return CornerUpRight;
  if (mod.includes("sharp left")) return CornerUpLeft;
  if (mod.includes("slight right") || type === "on ramp") return ArrowUpRight;
  if (mod.includes("slight left")) return ArrowUpLeft;
  if (mod.includes("right") || type === "off ramp") return ArrowRight;
  if (mod.includes("left")) return ArrowLeft;
  return ArrowUp;
}

// Unnamed steps (ramps, forks, exits) used to fall straight through to the
// destination address, so a fork 0.4 mi ahead read "6633 East Virginia B…".
// Signed destinations ("I 264 East: Norfolk") and the provider's own
// instruction describe the maneuver itself; the address is the last resort.
function maneuverBannerText(m) {
  const road = String(m?.road_name || "").trim();
  if (road) return road;
  const signed = String(m?.destinations || "").trim();
  if (signed) return signed;
  const instruction = String(m?.maneuver?.instruction || "").trim();
  return instruction && instruction !== "Continue" ? instruction : "";
}

function formatArrivalClock(remainingDurationS) {
  const s = Number(remainingDurationS);
  if (!Number.isFinite(s) || s <= 0) return "";
  return new Date(Date.now() + s * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function LockedGpsSurface({ nav, mapView, setMapView, cinematic, setCinematic, routeLoadError, loadingStops, deliveryStops, destinationAddresses, doorPinArrived, voiceGuidance, setVoiceGuidance, guidanceAudioError, onExit, searchOpen, setSearchOpen, onQuickSearch }) {
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [locatorOpen, setLocatorOpen] = useState(false);
  // Hands-free voice entry ("Hey LOKIN, start item locator"): the locked nav
  // surface consumes the open event so the camera homing overlay mounts ON TOP
  // of live navigation instead of navigating away mid-drive.
  useEffect(() => {
    if (!nav.route) return undefined;
    const onVoiceLocator = (e) => {
      if (e?.detail) e.detail.handled = true;
      setLocatorOpen(true);
    };
    window.addEventListener("lokin:open-item-locator", onVoiceLocator);
    return () => window.removeEventListener("lokin:open-item-locator", onVoiceLocator);
  }, [nav.route]);
  const error = nav.error || routeLoadError;
  const waiting = loadingStops || nav.status === "waiting_location" || nav.status === "routing" || nav.status === "rerouting";
  const arrived = nav.status === "arrived";
  const TurnIcon = maneuverTurnIcon(nav.maneuver);
  const bannerStreet = arrived
    ? "Destination reached"
    : (maneuverBannerText(nav.maneuver) || destinationAddresses[0] || "Follow the highlighted road");
  // Current street (Kendall 2026-10-02): the road the driver is ON right now,
  // from the most recently passed maneuver. Distinct from bannerStreet (next maneuver).
  const currentStreet = (() => {
    if (arrived) return null;
    const maneuvers = nav.route?.maneuvers || [];
    const alongM = Number(nav.snappedPosition?.along_route_m || 0);
    let current = null;
    for (const m of maneuvers) {
      if (Number(m?.along_route_m || 0) > alongM + 5) break;
      if (m?.road_name) current = m.road_name;
    }
    return current;
  })();
  const bannerDistance = nav.maneuver?.distance_from_driver_m != null
    ? formatDistance(nav.maneuver.distance_from_driver_m)
    : "\u2014";
  const arrivalClock = formatArrivalClock(nav.remainingDurationS);
  // The destination the ETA card counts down to — the last geocoded stop.
  const finalDestination = (nav.geocodedDestinations || [])[(nav.geocodedDestinations || []).length - 1] || null;

  return (
    <div className="fixed left-0 top-0 z-20 box-border h-[100dvh] w-screen max-w-[100vw] min-w-0 overflow-hidden overscroll-none bg-black text-white">
      {nav.route ? (
        <RoadMatchedMap
          routeGeometry={nav.route.geometry}
          deliveryStops={deliveryStops}
          snappedPosition={nav.snappedPosition}
          maneuver={nav.maneuver}
          remainingDurationS={nav.remainingDurationS}
          followDriver
          perspective={mapView === "4d"}
          fullscreen
          mapView={mapView}
          onActivateCinematic={() => { setMapView("4d"); setCinematic(true); }}
          cinematic={cinematic}
          onCinematicChange={setCinematic}
          onExit={onExit}
          onSelectMapView={(v) => { setMapView(v); setCinematic(false); }}
          onAskLokin={() => dispatchLokinCommand(LOKIN_COMMANDS.ASK, { phrase: "what should I do next" }, "gps-view")}
          maneuvers={nav.route?.maneuvers || []}
          remainingDistanceM={nav.remainingDistanceM}
          etaUpdatedAt={nav.etaUpdatedAt}
          etaLiveTraffic={nav.etaLiveTraffic}
          navigationStatus={nav.status}
          destinationSide={nav.route?.destination_side}
          doorPinArrived={doorPinArrived}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
          <img src={LOKIN_SKYLINE_BG} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-55" draggable={false} />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,10,0.58),rgba(2,6,5,0.9))]" />
          <div>
            <img src={LOKIN_CENTER} alt="" aria-hidden="true" className="mx-auto h-14 w-14 rounded-full border border-primary/35 bg-black/60 p-2 object-contain shadow-[0_0_18px_rgba(204,255,0,0.35)]" draggable={false} />
            <Radar className="mx-auto h-10 w-10 animate-pulse text-primary" />
            <div className="mt-4 font-display text-lg font-black tracking-[0.16em] text-primary">LOKIN GPS</div>
            <div className="mt-2 text-sm text-white/55">
              {error ? "Navigation needs attention" : waiting ? "Locking onto your live road route…" : "Waiting for a destination…"}
            </div>
            {!error && waiting && nav.waitingDetail && (
              <div className="mt-2 text-xs leading-relaxed text-white/40">{nav.waitingDetail}</div>
            )}
            {!error && waiting && nav.waitingDetail && (
              <button onClick={nav.restartLocation} className="mt-4 rounded-2xl bg-primary px-5 py-3 text-xs font-extrabold text-black">RETRY GPS</button>
            )}
          </div>
        </div>
      )}

      {/* Maneuver banner (2026-09-29 HUD cleanup, Google Maps reference):
          big turn arrow + street name + distance until turn. Lane-guidance
          and speed-limit elements are deliberately omitted — the route
          pipeline carries no lane or speed data, and LOKIN never invents it. */}
      {nav.route && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(0.5rem+env(safe-area-inset-top))] z-40 box-border px-[max(0.65rem,env(safe-area-inset-left))] [padding-right:max(0.65rem,env(safe-area-inset-right))]">
          <div className="pointer-events-auto flex items-center gap-3 rounded-3xl border border-primary/30 bg-black/85 px-4 py-3 shadow-[0_10px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 glow-primary">
                <TurnIcon className="h-8 w-8 text-primary" />
              </div>
              <div className="text-[11px] font-extrabold text-white">{bannerDistance}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="lokin-kicker lokin-kicker-lime">{arrived ? "ARRIVED" : "NEXT MANEUVER"}</div>
              <div className="line-clamp-2 break-words text-[clamp(1.15rem,5.2vw,1.6rem)] font-extrabold leading-tight text-white">{bannerStreet}</div>
            </div>
          </div>
        </div>
      )}

      {nav.offlineRoute && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(11rem+env(safe-area-inset-top))] z-40 -translate-x-1/2 rounded-full border border-amber-300/40 bg-black/85 px-3 py-1.5 text-[9px] font-extrabold tracking-[0.12em] text-amber-200 backdrop-blur">
          OFFLINE · CACHED ROUTE DATA
        </div>
      )}

      <RouteImprovementAlert improvement={nav.routeImprovement} onApply={nav.applyRouteImprovement} onDismiss={nav.dismissRouteImprovement} floating />

      {/* Right control stack (2026-09-29 HUD cleanup, Google Maps reference):
          circular guidance-voice control above the ETA sheet. The pulsing Ask
          LOKIN mic was removed 2026-09-29: the top-bar LOKIN pill triggers the
          same Ask LOKIN action, so the mic was redundant. */}
      <div className="absolute bottom-[calc(9rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col gap-2.5">
        {nav.route && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Quick search a destination"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/50 bg-black/85 text-primary shadow-lg backdrop-blur active:scale-95"
          >
            <Search className="h-6 w-6" />
          </button>
        )}
        {nav.route && (
          <button
            type="button"
            onClick={() => setLocatorOpen(true)}
            aria-label="Quick item locator — camera barcode homing"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/50 bg-black/85 text-primary shadow-lg backdrop-blur active:scale-95"
          >
            <PackageSearch className="h-6 w-6" />
          </button>
        )}
        {nav.route && (
          <button
            type="button"
            onClick={() => setVoicePanelOpen((v) => !v)}
            aria-label="Guidance voice settings"
            className={`flex h-14 w-14 items-center justify-center rounded-full border ${guidanceAudioError ? "border-amber-400/70" : "border-accent/50"} bg-black/85 text-accent shadow-lg backdrop-blur active:scale-95`}
          >
            {guidanceAudioError ? <Volume2 className="h-6 w-6 text-amber-400" /> : voiceGuidance ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
        )}
      </div>

      {/* Guidance voice panel: bottom-left above the ETA sheet (Kendall 2026-09-29:
          "move the voice picker down on to the hud"). */}
      {voicePanelOpen && nav.route && (
        <div className="absolute left-3 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-50 w-64 rounded-2xl border border-white/10 bg-black/92 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="lokin-kicker">Guidance voice</div>
            <button
              type="button"
              onClick={() => { unlockVoiceAudio(); setVoiceGuidance((v) => !v); }}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-white/70 active:scale-95"
            >
              {guidanceAudioError ? <Volume2 className="h-3.5 w-3.5 text-amber-400" /> : voiceGuidance ? <Volume2 className="h-3.5 w-3.5 text-accent" /> : <VolumeX className="h-3.5 w-3.5 text-white/35" />}
              {guidanceAudioError ? "RETRYING" : voiceGuidance ? "ON" : "MUTED"}
            </button>
          </div>
          <VoicePicker compact voiceKind="guidance" />
          <div className="mt-2 text-[10px] leading-relaxed text-white/40">Tap Preview to hear it, then drive. Saved on this device.</div>
        </div>
      )}

      {/* Current street banner (Kendall 2026-10-02): small pill just above the
          ETA sheet showing the road the driver is actually on. */}
      {nav.route && currentStreet && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/75 px-4 py-2 backdrop-blur-xl">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <div className="max-w-[70vw] truncate text-xs font-bold tracking-wide text-white/90">
              {currentStreet}
            </div>
          </div>
        </div>
      )}

      {/* ETA sheet (2026-09-29 HUD cleanup, Google Maps reference):
          big remaining time, distance + arrival clock, Exit. Replaces the
          old slim maneuver pill — the maneuver now lives in the top banner. */}
      {nav.route && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 box-border px-[max(0.65rem,env(safe-area-inset-left))] pb-[calc(0.65rem+env(safe-area-inset-bottom))] [padding-right:max(0.65rem,env(safe-area-inset-right))]">
          <div className="pointer-events-auto flex items-center gap-3 rounded-[1.75rem] border border-white/10 bg-black/88 px-5 py-3.5 shadow-[0_10px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              <div className="font-display text-[clamp(1.6rem,7vw,2.1rem)] font-black leading-none text-primary">
                {arrived ? "Arrived" : formatDuration(nav.remainingDurationS)}
              </div>
              <div className="mt-1.5 truncate text-xs font-semibold text-white/55">
                {arrived
                  ? `Destination reached${doorPinArrived ? " \u00b7 saved door pin" : ""}`
                  : `${nav.remainingDistanceM != null ? formatDistance(nav.remainingDistanceM) : "\u2014"}${arrivalClock ? ` \u00b7 ${arrivalClock}` : ""}`}
              </div>
              {finalDestination && (
                <DestinationHours
                  name={finalDestination.name}
                  latitude={finalDestination.latitude}
                  longitude={finalDestination.longitude}
                />
              )}
            </div>
            <button
              type="button"
              onClick={onExit}
              className="shrink-0 rounded-full border border-white/12 bg-white/[0.06] px-7 py-3.5 text-sm font-extrabold text-white/85 active:scale-95"
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {/* GPS quick search: re-point live navigation at a searched place. */}
      {searchOpen && (
        <GpsQuickSearch
          onClose={() => setSearchOpen(false)}
          proximity={(() => {
            const c = nav.snappedPosition?.coordinate;
            return Array.isArray(c) && c.length >= 2 ? { longitude: Number(c[0]), latitude: Number(c[1]) } : null;
          })()}
          onSelect={onQuickSearch}
        />
      )}

      {locatorOpen && <HudItemLocator onClose={() => setLocatorOpen(false)} />}

      {error && !nav.route && (
        <div className="absolute inset-x-4 top-1/2 z-40 -translate-y-1/2 rounded-3xl border border-red-500/30 bg-black/90 p-5 text-center backdrop-blur">
          <AlertTriangle className="mx-auto h-6 w-6 text-red-300" />
          <div className="mt-2 text-sm font-bold text-red-200">{error}</div>
          {destinationAddresses.length > 0 && (
            <button onClick={nav.rawPosition ? nav.retry : nav.restartLocation} className="mt-4 rounded-2xl bg-primary px-5 py-3 text-xs font-extrabold text-black">RETRY GPS</button>
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