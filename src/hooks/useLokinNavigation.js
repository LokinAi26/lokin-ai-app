import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDoorPin } from "@/lib/doorPins";
import { base44LiveFunctions } from "@/api/base44Client";
import {
  haversineMeters,
  nearestGeometryIndex,
  nextManeuverForSnap,
  prepareManeuvers,
  routeCumulativeDistances,
  matchToRouteHMM,
  evaluateArrivalState,
} from "@/lib/navigationGeometry";
import {
  drainNativeLocationQueue,
  nativeLocationAvailable,
  normalizeNativeLocationSample,
  requestNativeWhenInUse,
  requestNativeRuntimeStatus,
  startNativeLocation,
  stopNativeLocation,
  subscribeNativeLocation,
  subscribeNativeLocationAuthorization,
  subscribeNativeLocationError,
  subscribeNativeLocationQueue,
  subscribeNativeLocationRuntime,
} from "@/lib/nativeLocationBridge";
import { reroutePolicy } from "@/lib/navigationQuality";
import {
  navigationSampleIntervalMs,
  shouldAcceptNavigationSample,
} from "@/lib/navigationPerformance";
import {
  FUSION_CONFIG,
  FusionEngine,
  predictRender,
  recordRenderMs,
  recordRerouteAllowed,
  recordRerouteBlocked,
} from "@/lib/navFusion";
import { gpsSuperAgent } from "@/lib/gpsSuperAgent";
import { withTimeout } from "@/lib/promiseTimeout";
import { checkStoreGeofence, reportStoreArrival } from "@/lib/storeGeofence";
import { speakText } from "@/lib/lokinVoice";

function asCoord(position) {
  if (!position?.coords) return null;
  return [Number(position.coords.longitude), Number(position.coords.latitude)];
}

function voiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

// Proactive faster-route detection: how often to look while mid-delivery, the
// minimum savings worth alerting for (absolute + relative), and how long to
// stay quiet after the driver declines an offered route.
const IMPROVEMENT_CHECK_INTERVAL_MS = 180_000;
const IMPROVEMENT_MIN_SAVINGS_S = 120;
const IMPROVEMENT_MIN_SAVINGS_PCT = 0.1;
const IMPROVEMENT_DISMISS_COOLDOWN_MS = 600_000;

function addressHasGeographicContext(address) {
  const q = String(address || "").trim();
  return /\b\d{5}(?:-\d{4})?\b/.test(q) || /,\s*[A-Za-z .'-]{2,}(?:\s+[A-Z]{2})?(?:\s+\d{5}(?:-\d{4})?)?(?:,|$)/i.test(q);
}

export default function useLokinNavigation({ destinationAddresses = [], enabled = true, voiceGuidance = true } = {}) {
  const destinationsKey = useMemo(() => destinationAddresses.map((x) => String(x || "").trim()).filter(Boolean).join("||"), [destinationAddresses]);
  const normalizedDestinations = useMemo(() => destinationsKey ? destinationsKey.split("||") : [], [destinationsKey]);
  const [route, setRoute] = useState(null);
  const [geocodedDestinations, setGeocodedDestinations] = useState([]);
  const [rawPosition, setRawPosition] = useState(null);
  const [snapped, setSnapped] = useState(null);
  const [maneuver, setManeuver] = useState(null);
  const [status, setStatus] = useState(enabled ? "waiting_location" : "idle");
  const [error, setError] = useState("");
  const [rerouteCount, setRerouteCount] = useState(0);
  const [providerConfigured, setProviderConfigured] = useState(null);
  const [providerVerified, setProviderVerified] = useState(null);
  const [liveVectorConfigured, setLiveVectorConfigured] = useState(null);
  const [providerProbeError, setProviderProbeError] = useState("");
  const [trafficEta, setTrafficEta] = useState(null);
  const [routeImprovement, setRouteImprovement] = useState(null);
  const [nativeRuntime, setNativeRuntime] = useState(null);
  // Honest sub-copy for the GPS waiting screen: names the actual blocker
  // (permission pending, denied, or slow fix) instead of spinning forever.
  const [waitingDetail, setWaitingDetail] = useState("");
  const routeRef = useRef(null);
  const geocodedRef = useRef([]);
  const destinationsRef = useRef(normalizedDestinations);
  const cumulativeRef = useRef([]);
  const snappedRef = useRef(null);
  const etaRequestRef = useRef(0);
  const routeRequestRef = useRef(0);
  const improvementRequestRef = useRef(0);
  const improvementDismissedAtRef = useRef(0);
  const offRouteSamplesRef = useRef(0);
  const arrivalSamplesRef = useRef(0);
  const arrivedRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const lastSpokenRef = useRef("");
  const arrivalAnnouncedRef = useRef("");
  const startedKeyRef = useRef("");
  const nativeSeenAtRef = useRef(0);
  const nativeStartedRef = useRef(false);
  const lastNavFixRef = useRef(null); // latest accepted nav fix {lat, lon} for the grocery-geofence foreground re-check
  const webFixReceivedRef = useRef(false); // first web-geolocation fix arrived (watchdog guard)
  const lastAcceptedSampleRef = useRef(null);
  const [gpsModeVersion, setGpsModeVersion] = useState(() => gpsSuperAgent.getModeVersion());
  const [gpsRestartCounter, setGpsRestartCounter] = useState(0);
  const fusionEngineRef = useRef(null);
  if (!fusionEngineRef.current) fusionEngineRef.current = new FusionEngine();

  useEffect(() => {
    destinationsRef.current = normalizedDestinations;
    routeRef.current = null;
    cumulativeRef.current = [];
    geocodedRef.current = [];
    startedKeyRef.current = "";
    offRouteSamplesRef.current = 0;
    lastSpokenRef.current = "";
    lastAcceptedSampleRef.current = null;
    setRoute(null);
    setGeocodedDestinations([]);
    setSnapped(null);
    setManeuver(null);
    setRerouteCount(0);
    setTrafficEta(null);
    setRouteImprovement(null);
    arrivalSamplesRef.current = 0;
    arrivedRef.current = false;
  }, [destinationsKey]);
  // GPS Super Agent wiring (additive only — default mode preserves verified behavior).
  // The agent never owns the location engine; it subscribes to mode changes and
  // restart requests, and this hook re-acquires through its existing session.
  useEffect(() => {
    gpsSuperAgent.startMonitoring();
    const offMode = gpsSuperAgent.onModeChange((_mode, version) => setGpsModeVersion(version));
    gpsSuperAgent.registerRestartHandler(async () => {
      setGpsRestartCounter((n) => n + 1);
    });
    return () => {
      offMode();
      gpsSuperAgent.registerRestartHandler(null);
    };
  }, []);
  useEffect(() => { routeRef.current = route; }, [route]);
  useEffect(() => { geocodedRef.current = geocodedDestinations; }, [geocodedDestinations]);
  useEffect(() => { snappedRef.current = snapped; }, [snapped]);

  // Defensive client-side guard for hot-reload/stale responses. An incomplete
  // local address must never survive on-screen as a hundreds-of-miles route.
  useEffect(() => {
    const invalid = geocodedDestinations.find((g, i) => {
      const input = normalizedDestinations?.[i] || g?.input || "";
      return !addressHasGeographicContext(input) && Number(g?.proximity_miles) > 55;
    });
    const singleIncomplete = normalizedDestinations.length === 1 && !addressHasGeographicContext(normalizedDestinations[0]);
    const implausibleSingleRoute = singleIncomplete && Number(route?.distance_m || 0) > 80 * 1609.344;
    if (!invalid && !implausibleSingleRoute) return;
    routeRef.current = null;
    cumulativeRef.current = [];
    setRoute(null);
    setSnapped(null);
    setManeuver(null);
    setStatus("error");
    setError(`LOKIN blocked an implausible far-away match for “${invalid?.input || normalizedDestinations?.[0] || "this address"}”. Add city, state, or ZIP before navigating.`);
  }, [geocodedDestinations, destinationsKey, route?.distance_m]);

  // Resolve the driver's saved door pins before routing: any address with
  // a pin passes its coordinates straight through, so navigation ends at
  // the real door instead of the map's generic curb point.
  const doorPinCoordinates = useCallback((addresses) => {
    return (addresses || []).map((address) => {
      const pin = getDoorPin(address);
      return pin ? { longitude: pin.longitude, latitude: pin.latitude } : null;
    });
  }, []);

  const requestRoute = useCallback(async (originCoord, addresses, reason = "initial") => {
    if (!originCoord || !addresses?.length) return null;
    const requestId = ++routeRequestRef.current;
    if (reason === "initial") {
      routeRef.current = null;
      cumulativeRef.current = [];
      geocodedRef.current = [];
      setRoute(null);
      setGeocodedDestinations([]);
      setSnapped(null);
      setManeuver(null);
      setRerouteCount(0);
      arrivalSamplesRef.current = 0;
      arrivedRef.current = false;
    }
    setStatus(reason === "initial" ? "routing" : "rerouting");
    setError("");
    // Watchdog: the route service should answer in seconds. If it hangs, say so
    // instead of leaving the GPS screen on "Locking onto your live road route…".
    let routeSettled = false;
    const routeWatchdogId = window.setTimeout(() => {
      if (!routeSettled && routeRequestRef.current === requestId) {
        setStatus("error");
        setError("The route service is taking too long to respond. Check your connection and tap RETRY GPS.");
      }
    }, 60000);
    try {
      const response = await base44LiveFunctions.functions.invoke("navigation-engine", {
        action: "route_addresses",
        origin: { longitude: originCoord[0], latitude: originCoord[1] },
        destination_addresses: addresses,
        destination_coordinates: doorPinCoordinates(addresses),
        options: { profile: "driving-traffic", curbApproach: true },
      });
      if (requestId !== routeRequestRef.current) return null;
      const nextRoute = response.data?.route;
      const geocoded = response.data?.geocoded_destinations || [];
      const invalidLocalMatch = geocoded.find((g, i) => {
        const input = addresses?.[i] || g?.input || "";
        return !addressHasGeographicContext(input) && Number(g?.proximity_miles) > 55;
      });
      const singleIncomplete = addresses.length === 1 && !addressHasGeographicContext(addresses[0]);
      const implausibleSingleRoute = singleIncomplete && Number(nextRoute?.distance_m || 0) > 80 * 1609.344;
      if (invalidLocalMatch || implausibleSingleRoute) {
        throw new Error(`LOKIN blocked an implausible far-away match for “${invalidLocalMatch?.input || addresses?.[0] || "this address"}”. Add city, state, or ZIP before navigating.`);
      }
      if (!nextRoute?.geometry?.coordinates?.length) throw new Error("Routing provider returned no road geometry");
      const prepared = { ...nextRoute, maneuvers: prepareManeuvers(nextRoute) };
      routeRef.current = prepared;
      cumulativeRef.current = routeCumulativeDistances(prepared.geometry.coordinates);
      setRoute(prepared);
      setTrafficEta({
        duration_s: Number(prepared.duration_s || 0),
        distance_m: Number(prepared.distance_m || 0),
        generated_at: prepared.generated_at || new Date().toISOString(),
        live_traffic: prepared.live_traffic === true,
        received_at_ms: Date.now(),
      });

      // Snap the same GPS origin that requested the route immediately. iOS may
      // delay the next watchPosition callback, and the follow camera should not
      // be left without a driver target while a valid road route is already live.
      const initialSnap = matchToRouteHMM(originCoord, prepared.geometry.coordinates, cumulativeRef.current);
      if (initialSnap) {
        const enrichedInitialSnap = {
          ...initialSnap,
          raw_coordinate: originCoord,
          timestamp: Date.now(),
        };
        snappedRef.current = enrichedInitialSnap;
        setSnapped(enrichedInitialSnap);
        setManeuver(nextManeuverForSnap(prepared.maneuvers || [], initialSnap, prepared.geometry.coordinates));
      }

      geocodedRef.current = geocoded;
      setGeocodedDestinations(geocoded);
      offRouteSamplesRef.current = 0;
      lastSpokenRef.current = "";
      setStatus("navigating");
      if (reason !== "initial") setRerouteCount((n) => n + 1);
      setRouteImprovement(null);
      routeSettled = true;
      window.clearTimeout(routeWatchdogId);
      return prepared;
    } catch (e) {
      routeSettled = true;
      window.clearTimeout(routeWatchdogId);
      const detail = e?.response?.data;
      if (detail?.code === "NAV_PROVIDER_NOT_CONFIGURED") setProviderConfigured(false);
      setStatus("error");
      setError(detail?.error || e?.message || "Navigation route failed");
      return null;
    }
  }, []);

  const refreshTrafficEta = useCallback(async () => {
    const activeRoute = routeRef.current;
    const snap = snappedRef.current;
    const geometry = activeRoute?.geometry?.coordinates || [];
    if (!activeRoute || !snap?.coordinate || geometry.length < 2 || !geocodedRef.current.length) return null;

    const currentIndex = Number(snap.segment_index || 0);
    const remaining = geocodedRef.current.filter((g) => {
      const idx = nearestGeometryIndex([g.longitude, g.latitude], geometry);
      return idx >= currentIndex - 2;
    });
    const destinations = remaining.length ? remaining : geocodedRef.current.slice(-1);
    const coordinates = [
      { longitude: snap.coordinate[0], latitude: snap.coordinate[1] },
      ...destinations.map((g) => ({ longitude: g.longitude, latitude: g.latitude })),
    ];
    const requestId = ++etaRequestRef.current;
    try {
      const response = await base44LiveFunctions.functions.invoke("navigation-engine", { action: "traffic_eta", coordinates });
      if (requestId !== etaRequestRef.current) return null;
      const eta = response.data?.eta;
      if (!eta || !Number.isFinite(Number(eta.duration_s))) return null;
      const stamped = { ...eta, received_at_ms: Date.now() };
      setTrafficEta(stamped);
      return stamped;
    } catch {
      // Keep the last valid traffic ETA rather than replacing it with a fabricated estimate.
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !route) return;
    const timer = window.setInterval(refreshTrafficEta, 30000);
    return () => window.clearInterval(timer);
  }, [enabled, route?.generated_at, refreshTrafficEta]);

  // Proactive faster-route detection: while mid-delivery, periodically request a
  // fresh traffic-aware route from the live position to the remaining stops and
  // compare it with the current plan. A meaningfully faster route raises an
  // alert the driver can apply — the route never swaps without an explicit tap.
  const checkForRouteImprovement = useCallback(async () => {
    const activeRoute = routeRef.current;
    const snap = snappedRef.current;
    if (!activeRoute || !snap?.coordinate || snap.off_route === true || arrivedRef.current) return;
    const geometry = activeRoute.geometry?.coordinates || [];
    if (geometry.length < 2 || !destinationsRef.current.length) return;
    const currentIndex = Number(snap.segment_index || 0);
    const remaining = destinationsRef.current.filter((address, i) => {
      const g = geocodedRef.current?.[i];
      if (!g) return true;
      const idx = nearestGeometryIndex([g.longitude, g.latitude], geometry);
      return idx >= currentIndex - 2;
    });
    if (!remaining.length) return;
    const requestId = ++improvementRequestRef.current;
    try {
      const response = await base44LiveFunctions.functions.invoke("navigation-engine", {
        action: "route_addresses",
        origin: { longitude: snap.coordinate[0], latitude: snap.coordinate[1] },
        destination_addresses: remaining,
        destination_coordinates: doorPinCoordinates(remaining),
        options: { profile: "driving-traffic", curbApproach: true },
      });
      if (requestId !== improvementRequestRef.current) return;
      const candidate = response.data?.route;
      if (!candidate?.geometry?.coordinates?.length || !Number.isFinite(Number(candidate.duration_s))) return;
      const currentRemainingS = Math.max(0, Number(activeRoute.duration_s || 0) * (1 - Number(snap.progress || 0)));
      const savingsS = currentRemainingS - Number(candidate.duration_s);
      if (savingsS >= IMPROVEMENT_MIN_SAVINGS_S && savingsS >= IMPROVEMENT_MIN_SAVINGS_PCT * currentRemainingS) {
        setRouteImprovement({ savings_s: Math.round(savingsS), eta_s: Math.round(Number(candidate.duration_s)), received_at_ms: Date.now() });
      } else {
        setRouteImprovement(null);
      }
    } catch {
      /* detection is best-effort; keep the current plan */
    }
  }, []);

  // Apply re-requests the route from the driver's live position through the
  // same verified pipeline used for off-route recovery, so the swap is always
  // fresh and road-matched.
  const applyRouteImprovement = useCallback(() => {
    const snap = snappedRef.current;
    improvementDismissedAtRef.current = Date.now();
    setRouteImprovement(null);
    if (!snap?.coordinate) return;
    const activeRoute = routeRef.current;
    const geometry = activeRoute?.geometry?.coordinates || [];
    const currentIndex = Number(snap.segment_index || 0);
    const remaining = destinationsRef.current.filter((address, i) => {
      const g = geocodedRef.current?.[i];
      if (!g) return true;
      const idx = nearestGeometryIndex([g.longitude, g.latitude], geometry);
      return idx >= currentIndex - 2;
    });
    requestRoute(snap.coordinate, remaining.length ? remaining : destinationsRef.current.slice(-1), "off_route");
  }, [requestRoute]);

  const dismissRouteImprovement = useCallback(() => {
    improvementDismissedAtRef.current = Date.now();
    setRouteImprovement(null);
  }, []);

  useEffect(() => {
    if (!enabled || !route) return;
    const timer = window.setInterval(() => {
      if (Date.now() - improvementDismissedAtRef.current < IMPROVEMENT_DISMISS_COOLDOWN_MS) return;
      if (Date.now() - lastRerouteAtRef.current < 90_000) return;
      checkForRouteImprovement();
    }, IMPROVEMENT_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, route?.generated_at, checkForRouteImprovement]);

  useEffect(() => {
    if (!enabled) setStatus("idle");
    base44LiveFunctions.functions.invoke("navigation-engine", { action: "status" })
      .then((r) => {
        setProviderConfigured(Boolean(r.data?.configured));
        setLiveVectorConfigured(Boolean(r.data?.live_vector_configured));
      })
      .catch(() => {
        setProviderConfigured(false);
        setLiveVectorConfigured(false);
      });
  }, [enabled]);

  const probeProvider = useCallback(async () => {
    setProviderProbeError("");
    setProviderVerified(null);
    try {
      const response = await base44LiveFunctions.functions.invoke("navigation-engine", { action: "provider_probe" });
      const verified = Boolean(response.data?.verified);
      setProviderConfigured(Boolean(response.data?.configured));
      setProviderVerified(verified);
      setLiveVectorConfigured(Boolean(response.data?.live_vector_configured));
      if (!verified) setProviderProbeError("Mapbox responded, but the provider check was not verified.");
      return verified;
    } catch (e) {
      const detail = e?.response?.data;
      if (detail?.code === "NAV_PROVIDER_NOT_CONFIGURED") setProviderConfigured(false);
      setProviderVerified(false);
      setProviderProbeError(detail?.error || e?.message || "Mapbox provider check failed");
      return false;
    }
  }, []);

  const processLocationSample = useCallback((sample, source = "web") => {
    const coord = sample?.coordinate;
    if (!coord || coord.length < 2) return;
    const previousSample = lastAcceptedSampleRef.current;
    if (!shouldAcceptNavigationSample(sample, previousSample)) return;
    const intervalMs = navigationSampleIntervalMs(sample, previousSample);
    const acceptedSample = { ...sample, interval_ms: intervalMs };
    lastAcceptedSampleRef.current = acceptedSample;
    if (source === "native") nativeSeenAtRef.current = Date.now();
    // Grocery geofence on the nav GPS feed too (not just the shift feed): every
    // accepted nav fix is checked against nearby grocery/retail stores, so the
    // item locator fires while navigating even without an active shift.
    // Dead-reckoned fixes (tunnels/garages) are skipped to avoid phantom entries.
    const navLat = Number(coord[1]);
    const navLon = Number(coord[0]);
    if (Number.isFinite(navLat) && Number.isFinite(navLon)) {
      lastNavFixRef.current = { lat: navLat, lon: navLon };
      if (acceptedSample.dead_reckoned !== true) {
        try { checkStoreGeofence(navLat, navLon); } catch { /* geofence is best-effort */ }
      }
    }
    // GPS Super Agent monitoring: read-only sample report (never alters the pipeline).
    try { gpsSuperAgent.ingest(acceptedSample); } catch {}

    // Nav Fusion v3.5 — pass the accepted sample through the fusion engine and
    // render the map marker from the +render-horizon prediction, not the raw fix.
    const fusionEngine = fusionEngineRef.current;
    const fusionRenderStartMs = Date.now();
    const fusedPosition = fusionEngine.ingest(acceptedSample);
    const renderPosition = predictRender(fusedPosition, FUSION_CONFIG.renderPredictionHorizonMs);
    recordRenderMs(Date.now() - fusionRenderStartMs);
    setRawPosition({
      ...acceptedSample,
      coordinate: [Number(renderPosition.longitude), Number(renderPosition.latitude)],
      latitude: Number(renderPosition.latitude),
      longitude: Number(renderPosition.longitude),
      render_prediction_horizon_ms: FUSION_CONFIG.renderPredictionHorizonMs,
    });

    const key = destinationsRef.current.join("||");
    if (!routeRef.current && startedKeyRef.current !== key) {
      startedKeyRef.current = key;
      requestRoute(coord, destinationsRef.current, "initial");
      return;
    }

    const activeRoute = routeRef.current;
    const geometry = activeRoute?.geometry?.coordinates || [];
    if (!geometry.length) return;
    const snap = matchToRouteHMM(coord, geometry, cumulativeRef.current, {
      previousSnap: snappedRef.current,
      heading: acceptedSample.heading,
      speedMps: acceptedSample.speed_mps,
      accuracyM: acceptedSample.accuracy_m,
      timestamp: acceptedSample.timestamp,
    });
    if (!snap) return;
    // Off-route policy is evaluated here so the map can render the TRUE
    // position when the driver leaves the route.
    const policy = reroutePolicy(acceptedSample, snap);
    const offRoute = Number(snap.distance_m) > policy.thresholdM;
    const enrichedSnap = {
      ...snap,
      off_route: offRoute,
      raw_coordinate: coord,
      accuracy_m: acceptedSample.accuracy_m,
      heading: acceptedSample.heading,
      speed_mps: acceptedSample.speed_mps,
      timestamp: acceptedSample.timestamp,
      interval_ms: acceptedSample.interval_ms,
      seq: acceptedSample.seq,
      source: acceptedSample.source,
      confidence: acceptedSample.confidence,
      dead_reckoned: acceptedSample.dead_reckoned === true,
    };
    snappedRef.current = enrichedSnap;
    setSnapped(enrichedSnap);
    const next = nextManeuverForSnap(activeRoute.maneuvers || [], snap, geometry);
    setManeuver(next);

    const finalDestination = geocodedRef.current?.[geocodedRef.current.length - 1];
    const finalDestinationCoord = finalDestination
      ? [Number(finalDestination.longitude), Number(finalDestination.latitude)]
      : null;
    const finalDistanceM = finalDestinationCoord ? haversineMeters(coord, finalDestinationCoord) : Infinity;
    const totalRouteM = Number(routeRef.current?.distance_m || 0);
    const remainingRouteM = totalRouteM * (1 - Number(snap.progress || 0));
    // Arrival needs BOTH straight-line proximity and small remaining DRIVING
    // distance. The radius no longer grows with worse GPS — a bad fix must not
    // trigger an early arrival. Two consecutive fixes confirm it.
    // (Pure state machine in navigationGeometry.js — covered by regression tests.)
    const arrival = evaluateArrivalState({
      progress: snap.progress,
      finalDistanceM,
      remainingRouteM,
      arrivalSamples: arrivalSamplesRef.current,
      arrived: arrivedRef.current,
    });
    arrivalSamplesRef.current = arrival.arrivalSamples;
    arrivedRef.current = arrival.arrived;
    if (arrival.status === "navigating") {
      // Hysteresis: un-arrive — the driver is unambiguously still en route.
      setStatus("navigating");
    } else if (arrival.status === "arrived-hold") {
      offRouteSamplesRef.current = 0;
      setManeuver(null);
      return;
    } else if (arrival.status === "arrived") {
      offRouteSamplesRef.current = 0;
      setManeuver(null);
      setStatus("arrived");
      // Arrival-at-grocery: if navigation ended at a grocery/retail
      // destination, fire the store entry event directly even if a geofence
      // crossing was never detected (entry missed while GPS was suspended).
      try {
        const finalGeocoded = geocodedRef.current?.[geocodedRef.current.length - 1] || {};
        const destName = finalGeocoded.name || finalGeocoded.place_name
          || destinationsRef.current[destinationsRef.current.length - 1]
          || "";
        if (destName && coord && coord.length >= 2) {
          reportStoreArrival(destName, Number(coord[1]), Number(coord[0]));
        }
      } catch { /* geofence is best-effort */ }
      return;
    }

    // Road-match confidence feeds the fusion gate after snapping.
    fusionEngine.updateRoadMatch({ confidence: snap.match_confidence, distanceM: snap.distance_m });
    const fusionConfidence = fusionEngine.getConfidence();
    const fusionAllowsReroute = fusionEngine.shouldAllowReroute();
    // NOTE: `policy` is computed once up at the snap; reuse it here.
    if (acceptedSample.dead_reckoned === true) {
      // Dead-reckoned fixes keep the map moving through a tunnel/garage, but
      // never create a network reroute on their own. Wait for an absolute
      // Core Location / Fused Location Provider fix to confirm the deviation.
      offRouteSamplesRef.current = 0;
    } else if (snap.distance_m > policy.thresholdM) {
      offRouteSamplesRef.current += 1;
    } else {
      offRouteSamplesRef.current = 0;
    }

    const now = Date.now();
    if (policy.canReroute && !fusionAllowsReroute) {
      recordRerouteBlocked();
    }
    if (
      policy.canReroute &&
      fusionAllowsReroute &&
      offRouteSamplesRef.current >= policy.requiredSamples &&
      now - lastRerouteAtRef.current > policy.cooldownMs
    ) {
      recordRerouteAllowed(fusionConfidence?.positionConfidence ?? 0);
      lastRerouteAtRef.current = now;
      offRouteSamplesRef.current = 0;
      const currentIndex = snap.segment_index || 0;
      const remaining = destinationsRef.current.filter((address, i) => {
        const g = geocodedRef.current?.[i];
        if (!g) return true;
        const idx = nearestGeometryIndex([g.longitude, g.latitude], geometry);
        return idx >= currentIndex - 2;
      });
      requestRoute(coord, remaining.length ? remaining : destinationsRef.current.slice(-1), "off_route");
    }
  }, [requestRoute]);

  useEffect(() => {
    if (!enabled || !normalizedDestinations.length || !nativeLocationAvailable()) return;
    setStatus("waiting_location");
    setError("");
    setWaitingDetail("");

    // Watchdog: the native engine speaks only through event callbacks. If the
    // OS never delivers a permission decision or a fix (and no native error
    // fires), the same honesty rule as the web path applies — name the
    // blocker after 20s instead of spinning forever. A real fix clears it.
    const nativeWatchdogId = window.setTimeout(() => {
      setWaitingDetail("Still waiting on the LOKIN location engine — make sure location is allowed for LOKIN in device Settings and Location Services is on.");
    }, 20000);

    const unsubscribeLocation = subscribeNativeLocation((raw) => {
      const sample = normalizeNativeLocationSample(raw);
      if (sample) {
        window.clearTimeout(nativeWatchdogId);
        setWaitingDetail("");
        processLocationSample(sample, "native");
      }
    });
    const nativeSessionId = `lokin-nav-${Date.now()}`;
    const unsubscribeAuthorization = subscribeNativeLocationAuthorization((authorization) => {
      const authStatus = authorization?.status;
      if (["always", "whenInUse"].includes(authStatus) && !nativeStartedRef.current) {
        nativeStartedRef.current = true;
        setError("");
        setWaitingDetail("");
        startNativeLocation({ mode: gpsSuperAgent.getNativeMode(), sessionId: nativeSessionId });
        return;
      }
      if (["denied", "restricted"].includes(authStatus)) {
        window.clearTimeout(nativeWatchdogId);
        setWaitingDetail("");
        setStatus("error");
        setError("Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings.");
        return;
      }
      // Unrecognized authorization string (e.g. "notDetermined"): the OS has
      // not delivered a usable decision yet. Say so instead of leaving the
      // waiting screen on its generic copy. (Re-emitted "always"/"whenInUse"
      // after the engine started is intentionally a no-op.)
      else if (!["always", "whenInUse"].includes(authStatus)) {
        setWaitingDetail("Waiting on your location permission — allow location for LOKIN when your device asks.");
      }
    });
    const unsubscribeError = subscribeNativeLocationError((nativeError) => {
      setStatus("error");
      setError(nativeError?.message || "LOKIN native location engine reported an error.");
    });
    const unsubscribeRuntime = subscribeNativeLocationRuntime((payload) => {
      if (payload && typeof payload === "object") setNativeRuntime(payload);
    });
    const unsubscribeQueue = subscribeNativeLocationQueue((payload) => {
      const points = Array.isArray(payload?.points) ? payload.points : [];
      const latest = points
        .map(normalizeNativeLocationSample)
        .filter(Boolean)
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
      const ageMs = latest ? Math.max(0, Date.now() - Number(latest.timestamp || 0)) : Infinity;
      if (latest && ageMs <= 45_000 && Number(latest.accuracy_m || 0) <= 100) {
        processLocationSample({ ...latest, source: "native-warm-start" }, "native");
      }
    });

    requestNativeRuntimeStatus();

    // Start routing immediately from a recent trusted native fix while the OS
    // acquires a fresh navigation-grade anchor.
    drainNativeLocationQueue(12);

    // Native engines start only after the OS confirms permission. This avoids
    // racing Android's permission dialog and prevents a foreground service from
    // starting and immediately stopping before ACCESS_FINE/COARSE is granted.
    // Fail fast: the bridge exists but the shell did not accept the permission
    // command — re-posting it on every retry just loops the honest copy with
    // zero chance of a prompt. Name the real blocker immediately instead.
    const permissionRequestAccepted = requestNativeWhenInUse();
    if (!permissionRequestAccepted) {
      window.clearTimeout(nativeWatchdogId);
      setStatus("error");
      setError("The LOKIN app shell did not ask iOS for location. Grant Location for LOKIN in iOS Settings (While Using, with Precise Location on), or use the LOKIN website in Safari.");
    }

    return () => {
      window.clearTimeout(nativeWatchdogId);
      unsubscribeLocation();
      unsubscribeAuthorization();
      unsubscribeError();
      unsubscribeRuntime();
      unsubscribeQueue();
      if (nativeStartedRef.current) stopNativeLocation();
      nativeStartedRef.current = false;
    };
  }, [enabled, destinationsKey, normalizedDestinations.length, processLocationSample, gpsModeVersion, gpsRestartCounter]);

  useEffect(() => {
    if (!enabled || !normalizedDestinations.length || nativeLocationAvailable()) return;
    if (!navigator.geolocation) {
      setStatus("error");
      setError("This device does not expose GPS location to LOKIN.");
      return;
    }

    setStatus("waiting_location");
    setWaitingDetail("");
    webFixReceivedRef.current = false;

    // Watchdog: watchPosition can hang forever when the OS never delivers a
    // permission decision or a fix (common in embedded preview WebViews). After
    // 20s with no fix, name the actual blocker instead of spinning forever.
    const watchdogId = window.setTimeout(() => {
      if (webFixReceivedRef.current) return;
      const probe = navigator.permissions?.query
        ? navigator.permissions.query({ name: "geolocation" }).then((p) => p?.state, () => "unknown")
        : Promise.resolve("unknown");
      probe.then((permissionState) => {
        if (webFixReceivedRef.current) return;
        if (permissionState === "denied") {
          setStatus("error");
          setError("Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings.");
        } else if (permissionState === "prompt") {
          // Honest copy: inside the stock app wrapper no device prompt is
          // coming on its own — only the app shell can ask iOS for location.
          // Never promise a prompt that can't arrive.
          setWaitingDetail("Still waiting on your location permission. If a prompt appears, allow Precise Location. In the LOKIN app no prompt appears on its own — grant Location for LOKIN in iOS Settings (While Using, with Precise Location on), or use the LOKIN website in Safari.");
        } else if (permissionState === "granted") {
          setWaitingDetail("GPS fix is taking longer than usual — make sure Location Services is on and you have a clear view of the sky.");
        } else {
          setWaitingDetail("Still waiting for your device's GPS — check that Location Services is on and location is allowed for this page.");
        }
      });
    }, 20000);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coord = asCoord(position);
        if (!coord) return;
        webFixReceivedRef.current = true;
        setWaitingDetail("");
        window.clearTimeout(watchdogId);
        processLocationSample({
          coordinate: coord,
          latitude: coord[1],
          longitude: coord[0],
          accuracy_m: Number(position.coords.accuracy || 0),
          heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          speed_mps: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
          altitude_m: Number.isFinite(position.coords.altitude) ? position.coords.altitude : null,
          timestamp: position.timestamp || Date.now(),
          source: "web-geolocation",
        }, "web");
      },
      (geoError) => {
        window.clearTimeout(watchdogId);
        setWaitingDetail("");
        setStatus("error");
        const message = geoError?.code === 1
          ? "Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings."
          : geoError?.message || "LOKIN could not read the current GPS position.";
        setError(message);
      },
      gpsSuperAgent.getWebOptions(),
    );

    return () => {
      window.clearTimeout(watchdogId);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, destinationsKey, normalizedDestinations.length, processLocationSample, gpsModeVersion, gpsRestartCounter]);

  // Grocery-geofence foreground re-check: iOS suspends web GPS behind another
  // app (e.g. the Dasher app), so a store entry that happened while
  // backgrounded is only detected once LOKIN comes back to the front.
  useEffect(() => {
    const onForeground = () => {
      const f = lastNavFixRef.current;
      if (f && Number.isFinite(f.lat) && Number.isFinite(f.lon)) {
        try { checkStoreGeofence(f.lat, f.lon); } catch { /* best-effort */ }
      }
    };
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    return () => {
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, []);

  useEffect(() => {
    if (!voiceGuidance || !voiceSupported() || !maneuver) return;
    const distance = Number(maneuver.distance_from_driver_m);
    if (!Number.isFinite(distance) || distance > 360) return;
    const key = `${maneuver.leg_index}:${maneuver.step_index}`;
    if (lastSpokenRef.current === key) return;
    const text = maneuver?.maneuver?.instruction;
    if (!text) return;
    lastSpokenRef.current = key;
    // Shared LOKIN voice: user-picked male/female voice + iOS silent-speech workarounds.
    speakText(text, { rate: 1.02, pitch: 0.96, volume: 0.9 });
  }, [maneuver?.leg_index, maneuver?.step_index, maneuver?.distance_from_driver_m, voiceGuidance]);

  // Arrival announcement: once per route, tell the driver which side the
  // destination is on so they find the front entrance, not the back of the block.
  useEffect(() => {
    if (status !== "arrived" || !voiceGuidance || !voiceSupported()) return;
    const routeKey = route?.generated_at || "";
    if (!routeKey || arrivalAnnouncedRef.current === routeKey) return;
    arrivalAnnouncedRef.current = routeKey;
    const side = route?.destination_side;
    const atDoorPin = (geocodedDestinations || []).some((g) => g?.door_pin === true);
    const pinWord = atDoorPin ? " at your saved door pin" : "";
    const text = side === "left" || side === "right"
      ? `You have arrived${pinWord}. The destination is on your ${side}.`
      : `You have arrived${pinWord}. The destination is just ahead.`;
    speakText(text, { rate: 1.02, pitch: 0.96, volume: 0.9 });
  }, [status, voiceGuidance, route?.generated_at, route?.destination_side, geocodedDestinations]);

  const retry = useCallback(() => {
    const coord = rawPosition?.coordinate;
    if (!coord || !destinationsRef.current.length) return;
    startedKeyRef.current = destinationsRef.current.join("||");
    requestRoute(coord, destinationsRef.current, "initial");
  }, [rawPosition, requestRoute]);

  // Re-run location acquisition (re-registers watchPosition / re-prompts).
  // Used by RETRY GPS when no position was ever acquired (e.g. denied permission).
  const restartLocation = useCallback(() => {
    setError("");
    setWaitingDetail("");
    webFixReceivedRef.current = false;
    // A stale watch registration alone may never deliver a fresh fix — fire a
    // bounded one-shot probe as well. A success feeds the same pipeline as a
    // watch fix; a timeout only surfaces as waiting detail while still
    // waiting, never clobbering a real error state.
    if (navigator.geolocation) {
      withTimeout(
        new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
        ),
        20000,
        "GPS retry timed out"
      ).then((position) => {
        const coord = asCoord(position);
        if (!coord) return;
        webFixReceivedRef.current = true;
        setWaitingDetail("");
        processLocationSample({
          coordinate: coord,
          latitude: coord[1],
          longitude: coord[0],
          accuracy_m: Number(position.coords.accuracy || 0),
          heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          speed_mps: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
          altitude_m: Number.isFinite(position.coords.altitude) ? position.coords.altitude : null,
          timestamp: position.timestamp || Date.now(),
          source: "web-geolocation-retry",
        }, "web");
      }).catch((err) => {
        if (webFixReceivedRef.current) return;
        setWaitingDetail(err?.message || "GPS retry timed out — still waiting for a fix.");
      });
    }
    setGpsRestartCounter((n) => n + 1);
  }, [processLocationSample]);

  const fallbackRemainingDistanceM = route && snapped ? Math.max(0, Number(route.distance_m || 0) * (1 - snapped.progress)) : Number(route?.distance_m || 0);
  const fallbackRemainingDurationS = route && snapped ? Math.max(0, Number(route.duration_s || 0) * (1 - snapped.progress)) : Number(route?.duration_s || 0);
  const etaAgeMs = trafficEta?.received_at_ms ? Math.max(0, Date.now() - Number(trafficEta.received_at_ms)) : Infinity;
  const etaFresh = etaAgeMs <= 45_000;
  const remainingDistanceM = etaFresh && Number.isFinite(Number(trafficEta?.distance_m))
    ? Number(trafficEta.distance_m)
    : fallbackRemainingDistanceM;
  const etaElapsedS = etaFresh ? etaAgeMs / 1000 : 0;
  const trafficRemainingDurationS = etaFresh && Number.isFinite(Number(trafficEta?.duration_s))
    ? Math.max(0, Number(trafficEta.duration_s) - etaElapsedS)
    : null;
  // A stale traffic snapshot must never count down to a false 0-minute arrival.
  // Once it ages out, fall back to route progress until the next provider refresh.
  const remainingDurationS = trafficRemainingDurationS != null
    ? (status === "arrived" ? 0 : Math.max(1, trafficRemainingDurationS))
    : (status === "arrived" ? 0 : Math.max(1, fallbackRemainingDurationS));

  return {
    route,
    geocodedDestinations,
    rawPosition,
    snappedPosition: snapped,
    maneuver,
    status,
    error,
    retry,
    restartLocation,
    waitingDetail,
    rerouteCount,
    providerConfigured,
    providerVerified,
    liveVectorConfigured,
    providerProbeError,
    probeProvider,
    remainingDistanceM,
    remainingDurationS,
    etaUpdatedAt: trafficEta?.generated_at || route?.generated_at || null,
    etaLiveTraffic: trafficEta?.live_traffic === true || route?.live_traffic === true,
    refreshTrafficEta,
    routeImprovement,
    applyRouteImprovement,
    dismissRouteImprovement,
    voiceSupported: voiceSupported(),
    nativeRuntime,
  };
}
