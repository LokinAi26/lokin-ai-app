import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CircleCheck, Lock, MapPin, Mic, Move, Navigation, Pause, Power, Radar, RefreshCw, Route as RouteIcon, Satellite, Volume2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SatelliteRoutePreview from "@/components/SatelliteRoutePreview";
import RoadMatchedMap from "@/components/RoadMatchedMap";
import RouteImprovementAlert from "@/components/nav/RouteImprovementAlert";
import { speakText } from "@/lib/lokinVoice";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import useLokinNavigation from "@/hooks/useLokinNavigation";
import { dispatchLokinCommand, LOKIN_COMMANDS } from "@/lib/lokinCommandBus";
import { formatDistance, formatDuration } from "@/lib/navigationGeometry";
import { loadOptimizedRouteSession } from "@/lib/optimizedRouteSession";
import { saveSessionRouteRecord } from "@/lib/sessionRouteRecord";
import useRouteImprovementPush from "@/hooks/useRouteImprovementPush";

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

    // Opening GPS must not implicitly optimize offers or block destination search.
    setStops([]);
    setLoadingStops(false);
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
  // True when the final routed destination resolved from the driver's own saved door pin.
  const arrivedAtDoorPin = (nav.geocodedDestinations || []).some((g) => g?.door_pin === true);

  // Instant faster-route alerts: web notification + native push (one per detection).
  useRouteImprovementPush(nav.routeImprovement);

  // Voice-announce faster-route finds so the driver never has to check the map.
  useEffect(() => {
    if (!nav.routeImprovement || !voiceGuidance) return;
    const mins = Math.max(1, Math.round(nav.routeImprovement.savings_s / 60));
    speakText(`Faster route available. You can save about ${mins} minutes.`, { rate: 1.02, pitch: 0.96, volume: 0.9 });
  }, [nav.routeImprovement?.received_at_ms, voiceGuidance]);

  // Active delivery points in the already-optimized sequence, for the 3D map's
  // clustered stop layer (1 → N fastest, fuel-saving order).
  const deliveryStops = useMemo(() => {
    return (nav.geocodedDestinations || [])
      .map((g, i) => ({
        sequence: i + 1,
        coordinate: [Number(g.longitude), Number(g.latitude)],
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
        routeLoadError={routeLoadError}
        loadingStops={loadingStops}
        deliveryStops={deliveryStops}
        destinationAddresses={destinationAddresses}
        doorPinArrived={arrivedAtDoorPin}
        onOpenAppFreeRoam={openAppFreeRoam}
        onExit={() => navigate("/", { replace: true })}
      />
    );
  }

  return (
    <div className={`${locked ? "p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]" : "p-4"} space-y-4 pb-6`}>
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
              <button onClick={() => setVoiceGuidance((v) => !v)} className="h-12 w-12 shrink-0 rounded-full border border-accent/40 bg-black/60 flex items-center justify-center glow-cyan">
                <Volume2 className={`h-5 w-5 ${voiceGuidance ? "text-accent" : "text-white/35"}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="lokin-kicker lokin-kicker-cyan">LOKIN COPILOT · {nav.status === "navigating" ? "ROAD LOCKED" : nav.status.toUpperCase()}</div>
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

function LockedGpsSurface({ nav, mapView, setMapView, routeLoadError, loadingStops, deliveryStops, destinationAddresses, doorPinArrived, onOpenAppFreeRoam, onExit }) {
  const error = nav.error || routeLoadError;
  const waiting = loadingStops || nav.status === "waiting_location" || nav.status === "routing" || nav.status === "rerouting";

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
          etaLiveTraffic={nav.etaLiveTraffic}
          navigationStatus={nav.status}
          destinationSide={nav.route?.destination_side}
          doorPinArrived={doorPinArrived}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#081008] px-8 text-center">
          <div>
            <Radar className="mx-auto h-10 w-10 animate-pulse text-primary" />
            <div className="mt-4 font-display text-lg font-black tracking-[0.16em] text-primary">LOKIN GPS</div>
            <div className="mt-2 text-sm text-white/55">
              {error ? "Navigation needs attention" : waiting ? "Locking onto your live road route…" : "Waiting for a destination…"}
            </div>
            {!error && waiting && nav.waitingDetail && (
              <div className="mt-2 text-xs leading-relaxed text-white/40">{nav.waitingDetail}</div>
            )}
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

      <RouteImprovementAlert improvement={nav.routeImprovement} onApply={nav.applyRouteImprovement} onDismiss={nav.dismissRouteImprovement} floating />

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