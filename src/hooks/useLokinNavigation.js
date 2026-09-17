import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function asCoord(position) {
  if (!position?.coords) return null;
  return [Number(position.coords.longitude), Number(position.coords.latitude)];
}

function voiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

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
  const [nativeRuntime, setNativeRuntime] = useState(null);
  const routeRef = useRef(null);
  const geocodedRef = useRef([]);
  const destinationsRef = useRef(normalizedDestinations);
  const cumulativeRef = useRef([]);
  const snappedRef = useRef(null);
  const etaRequestRef = useRef(0);
  const routeRequestRef = useRef(0);
  const offRouteSamplesRef = useRef(0);
  const arrivalSamplesRef = useRef(0);
  const arrivedRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const lastSpokenRef = useRef("");
  const startedKeyRef = useRef("");
  const nativeSeenAtRef = useRef(0);
  const nativeStartedRef = useRef(false);
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
    try {
      const response = await base44LiveFunctions.functions.invoke("navigation-engine", {
        action: "route_addresses",
        origin: { longitude: originCoord[0], latitude: originCoord[1] },
        destination_addresses: addresses,
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
      return prepared;
    } catch (e) {
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

    const unsubscribeLocation = subscribeNativeLocation((raw) => {
      const sample = normalizeNativeLocationSample(raw);
      if (sample) processLocationSample(sample, "native");
    });
    const nativeSessionId = `lokin-nav-${Date.now()}`;
    const unsubscribeAuthorization = subscribeNativeLocationAuthorization((authorization) => {
      const authStatus = authorization?.status;
      if (["always", "whenInUse"].includes(authStatus) && !nativeStartedRef.current) {
        nativeStartedRef.current = true;
        setError("");
        startNativeLocation({ mode: gpsSuperAgent.getNativeMode(), sessionId: nativeSessionId });
        return;
      }
      if (["denied", "restricted"].includes(authStatus)) {
        setStatus("error");
        setError("Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings.");
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
    requestNativeWhenInUse();

    return () => {
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
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coord = asCoord(position);
        if (!coord) return;
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
        setStatus("error");
        const message = geoError?.code === 1
          ? "Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings."
          : geoError?.message || "LOKIN could not read the current GPS position.";
        setError(message);
      },
      gpsSuperAgent.getWebOptions(),
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, destinationsKey, normalizedDestinations.length, processLocationSample, gpsModeVersion, gpsRestartCounter]);

  useEffect(() => {
    if (!voiceGuidance || !voiceSupported() || !maneuver) return;
    const distance = Number(maneuver.distance_from_driver_m);
    if (!Number.isFinite(distance) || distance > 360) return;
    const key = `${maneuver.leg_index}:${maneuver.step_index}`;
    if (lastSpokenRef.current === key) return;
    const text = maneuver?.maneuver?.instruction;
    if (!text) return;
    lastSpokenRef.current = key;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 0.96;
      utterance.volume = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, [maneuver?.leg_index, maneuver?.step_index, maneuver?.distance_from_driver_m, voiceGuidance]);

  const retry = useCallback(() => {
    const coord = rawPosition?.coordinate;
    if (!coord || !destinationsRef.current.length) return;
    startedKeyRef.current = destinationsRef.current.join("||");
    requestRoute(coord, destinationsRef.current, "initial");
  }, [rawPosition, requestRoute]);

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
    voiceSupported: voiceSupported(),
    nativeRuntime,
  };
}