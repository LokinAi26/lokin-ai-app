import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadOfflineRoute, saveOfflineRoute } from "@/lib/offlineRouteCache";
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
  nativeLocationAvailable,
  normalizeNativeLocationSample,
  subscribeNativeLocation,
  subscribeNativeLocationAuthorization,
  subscribeNativeLocationError,
  subscribeNativeLocationRuntime,
} from "@/lib/nativeLocationBridge";
import {
  LOCATION_SAMPLE_EVENT,
  LOCATION_SESSION_EVENT,
  getSessionState as getLocationSessionState,
  reacquire as reacquireLocationSession,
} from "@/lib/lokinLocationSession";
import { reroutePolicy } from "@/lib/navigationQuality";
import { logTrafficDelay, streetFromInstruction } from "@/lib/trafficDelayLog";
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
import { speakGuidance } from "@/lib/lokinVoicePipeline";
import { playNavCue } from "@/lib/navAudioCue";

function asCoord(position) {
  if (!position?.coords) return null;
  return [Number(position.coords.longitude), Number(position.coords.latitude)];
}

function voiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

// Natural spoken distance for the early turn prompt: short distances in
// feet, longer ones in quarter-mile steps.
function spokenDistance(meters) {
  const feet = meters * 3.28084;
  if (feet < 1320) return `${Math.max(100, Math.round(feet / 100) * 100)} feet`;
  const miles = feet / 5280;
  const quarters = Math.max(1, Math.round(miles * 4));
  if (quarters === 1) return "a quarter mile";
  if (quarters === 2) return "a half mile";
  if (quarters === 3) return "three quarters of a mile";
  if (quarters === 4) return "1 mile";
  const whole = quarters / 4;
  return `${Number.isInteger(whole) ? whole : whole.toFixed(2).replace(/\.?0+$/, "")} miles`;
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
  // Mirror + dedupe refs for the spoken traffic-delay warning and the
  // on-demand "check traffic" voice report.
  const trafficEtaRef = useRef(null);
  const trafficAlertDelayRef = useRef(0);
  useEffect(() => { trafficEtaRef.current = trafficEta; }, [trafficEta]);
  const voiceGuidanceRef = useRef(voiceGuidance);
  voiceGuidanceRef.current = voiceGuidance;
  const [routeImprovement, setRouteImprovement] = useState(null);
  const [offlineRoute, setOfflineRoute] = useState(false);
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
  // Per-maneuver announcement phase: 0 = not spoken, 1 = early prompt done,
  // 2 = immediate prompt done. Lets each turn be announced twice — once with
  // distance ("In a quarter mile, turn right onto Main Street") and once at
  // the turn itself.
  const lastSpokenRef = useRef({ key: "", phase: 0 });
  const arrivalAnnouncedRef = useRef("");
  const startedKeyRef = useRef("");
  const nativeSeenAtRef = useRef(0);
  const lastNavFixRef = useRef(null); // latest accepted nav fix {lat, lon} for the grocery-geofence foreground re-check
  const webFixReceivedRef = useRef(false); // first web-geolocation fix arrived (watchdog guard)
  const lastAcceptedSampleRef = useRef(null);
  // HUD anti-flicker latches (2026-09-26): the maneuver card and ETA are
  // derived from every GPS fix, so a parked phone's position wander must not
  // visibly flip them. Both latches only advance forward and reset on a new
  // route or navigation teardown.
  const latchedManeuverRef = useRef(null);
  const maneuverAdvanceStreakRef = useRef(0);
  const etaDisplayMinRef = useRef(null);
  const etaUpStreakRef = useRef(0);
  const positionWindowRef = useRef([]);
  const [etaDisplayS, setEtaDisplayS] = useState(null);
  const fusionEngineRef = useRef(null);
  if (!fusionEngineRef.current) fusionEngineRef.current = new FusionEngine();

  useEffect(() => {
    destinationsRef.current = normalizedDestinations;
    routeRef.current = null;
    cumulativeRef.current = [];
    geocodedRef.current = [];
    startedKeyRef.current = "";
    offRouteSamplesRef.current = 0;
    lastSpokenRef.current = { key: "", phase: 0 };
    lastAcceptedSampleRef.current = null;
    setRoute(null);
    setGeocodedDestinations([]);
    setSnapped(null);
    setManeuver(null);
    latchedManeuverRef.current = null;
    maneuverAdvanceStreakRef.current = 0;
    etaDisplayMinRef.current = null;
    etaUpStreakRef.current = 0;
    positionWindowRef.current = [];
    setEtaDisplayS(null);
    setRerouteCount(0);
    setTrafficEta(null);
    setRouteImprovement(null);
    setOfflineRoute(false);
    arrivalSamplesRef.current = 0;
    arrivedRef.current = false;
  }, [destinationsKey]);
  // GPS Super Agent wiring (additive only — default mode preserves verified behavior).
  // Raw acquisition now lives in the app-scope location session
  // (lokinLocationSession): it registers the permanent restart handler and
  // the accuracy-mode-change re-acquire at app launch. This hook only keeps
  // the agent's health monitoring and subscribes to the session's sample bus.
  useEffect(() => {
    gpsSuperAgent.startMonitoring();
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
    latchedManeuverRef.current = null;
    maneuverAdvanceStreakRef.current = 0;
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
      latchedManeuverRef.current = null;
      maneuverAdvanceStreakRef.current = 0;
      etaDisplayMinRef.current = null;
      etaUpStreakRef.current = 0;
      positionWindowRef.current = [];
      setEtaDisplayS(null);
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
        options: { profile: "driving-traffic", curbApproach: true, originHeading: originHeadingForRoute(lastAcceptedSampleRef.current) },
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
        const initialManeuver = nextManeuverForSnap(prepared.maneuvers || [], initialSnap, prepared.geometry.coordinates);
        latchedManeuverRef.current = initialManeuver;
        maneuverAdvanceStreakRef.current = 0;
        setManeuver(initialManeuver);
      }

      geocodedRef.current = geocoded;
      setGeocodedDestinations(geocoded);
      offRouteSamplesRef.current = 0;
      lastSpokenRef.current = { key: "", phase: 0 };
      setStatus("navigating");
      // Fresh live route: clear the offline indicator and refresh the
      // on-device copy so a later dead zone falls back to current data.
      setOfflineRoute(false);
      saveOfflineRoute(prepared, geocoded, destinationsRef.current.join("||"));
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
      // Dead-zone resilience: the route service is unreachable but this
      // exact trip is cached on-device — continue navigating from the saved
      // route instead of dropping the driver to an error screen.
      if (!routeRef.current) {
        const cached = loadOfflineRoute(destinationsRef.current.join("||"));
        if (cached) {
          const restored = { ...cached.route, maneuvers: prepareManeuvers(cached.route) };
          routeRef.current = restored;
          cumulativeRef.current = routeCumulativeDistances(restored.geometry.coordinates);
          setRoute(restored);
          setTrafficEta({
            duration_s: Number(restored.duration_s || 0),
            distance_m: Number(restored.distance_m || 0),
            generated_at: cached.saved_at,
            live_traffic: false,
            received_at_ms: Date.now(),
          });
          const cachedSnap = matchToRouteHMM(originCoord, restored.geometry.coordinates, cumulativeRef.current);
          if (cachedSnap) {
            const enrichedCachedSnap = { ...cachedSnap, raw_coordinate: originCoord, timestamp: Date.now() };
            snappedRef.current = enrichedCachedSnap;
            setSnapped(enrichedCachedSnap);
            const cachedManeuver = nextManeuverForSnap(restored.maneuvers || [], cachedSnap, restored.geometry.coordinates);
            latchedManeuverRef.current = cachedManeuver;
            maneuverAdvanceStreakRef.current = 0;
            setManeuver(cachedManeuver);
          }
          geocodedRef.current = cached.geocoded || [];
          setGeocodedDestinations(cached.geocoded || []);
          offRouteSamplesRef.current = 0;
          lastSpokenRef.current = { key: "", phase: 0 };
          setStatus("navigating");
          setOfflineRoute(true);
          return restored;
        }
      }
      setStatus("error");
      setError(detail?.error || e?.message || "Navigation route failed");
      return null;
    }
  }, []);

  // Offline resilience (2026-09-28): while actively navigating, keep
  // refreshing the on-device route cache so a dead zone or app reload always
  // has current route data to continue from.
  useEffect(() => {
    if (status !== "navigating") return undefined;
    const timer = window.setInterval(() => {
      const activeRoute = routeRef.current;
      if (activeRoute) saveOfflineRoute(activeRoute, geocodedRef.current, destinationsRef.current.join("||"));
    }, 60000);
    return () => window.clearInterval(timer);
  }, [status]);

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
      // Spoken traffic-delay warning: compare the fresh live ETA with what the
      // current plan would take from this position. A meaningful slowdown is
      // announced once — attention chime + voice — so the driver never has to
      // look at the screen. Re-arms once the delay clears; a further slowdown
      // of a minute or more re-announces with the new number.
      if (voiceGuidanceRef.current) {
        const planRemainingS = Math.max(0, Number(activeRoute.duration_s || 0) * (1 - Number(snap.progress || 0)));
        const delayS = Number(eta.duration_s) - planRemainingS;
        if (planRemainingS > 60 && delayS >= 120 && delayS >= 0.15 * planRemainingS) {
          const prevAnnounced = trafficAlertDelayRef.current;
          if (prevAnnounced === 0 || Math.abs(delayS - prevAnnounced) >= 60) {
            trafficAlertDelayRef.current = Math.round(delayS);
            const mins = Math.max(1, Math.round(delayS / 60));
            playNavCue("imminent");
            speakGuidance(`Heads up — traffic on your route. You're running about ${mins} minute${mins === 1 ? "" : "s"} slower than planned.`);
            // Delay log (2026-10-03): each announced slowdown is recorded with
            // its location, magnitude and day part so the driver can review
            // which areas to avoid at which hours.
            const loggedManeuver = nextManeuverForSnap(activeRoute.maneuvers || [], snap, activeRoute.geometry?.coordinates || []);
            logTrafficDelay({
              coordinate: snap?.coordinate,
              streetName: streetFromInstruction(loggedManeuver?.maneuver?.instruction || ""),
              delayMinutes: mins,
              source: "auto_warning",
            });
          }
        } else {
          trafficAlertDelayRef.current = 0;
        }
      }
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

  // Voice-activated traffic/hazard report ("Hey LOKIN, check traffic"): the
  // voice assistant dispatches lokin:traffic-report; while navigation is live
  // this answers with the freshest real traffic ETA spoken through the same
  // guidance audio. No route live → the event stays unhandled and the
  // assistant reports that navigation isn't active.
  useEffect(() => {
    if (!enabled) return undefined;
    const onTrafficReport = (e) => {
      const activeRoute = routeRef.current;
      if (!activeRoute) return;
      const snap = snappedRef.current;
      const eta = trafficEtaRef.current;
      if (e?.detail) e.detail.handled = true;
      const etaS = Number(eta?.duration_s);
      if (!Number.isFinite(etaS)) {
        speakGuidance("No traffic data yet for your route. LOKIN will warn you if that changes.");
        return;
      }
      const mins = Math.max(1, Math.round(etaS / 60));
      const planRemainingS = Math.max(0, Number(activeRoute.duration_s || 0) * (1 - Number(snap?.progress || 0)));
      const delayS = etaS - planRemainingS;
      const text = planRemainingS > 60 && delayS >= 120
        ? `Traffic check: about ${mins} minutes to your last stop — running roughly ${Math.max(1, Math.round(delayS / 60))} minutes behind plan.`
        : `Traffic check: about ${mins} minutes to your last stop. No significant delays.`;
      playNavCue("approach");
      speakGuidance(text);
      // A voice-reported slowdown is logged too, tagged as a driver report.
      if (planRemainingS > 60 && delayS >= 120) {
        const loggedManeuver = nextManeuverForSnap(activeRoute.maneuvers || [], snap, activeRoute.geometry?.coordinates || []);
        logTrafficDelay({
          coordinate: snap?.coordinate,
          streetName: streetFromInstruction(loggedManeuver?.maneuver?.instruction || ""),
          delayMinutes: Math.max(1, Math.round(delayS / 60)),
          source: "voice_report",
        });
      }
    };
    window.addEventListener("lokin:traffic-report", onTrafficReport);
    return () => window.removeEventListener("lokin:traffic-report", onTrafficReport);
  }, [enabled]);

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
    const candidate = nextManeuverForSnap(activeRoute.maneuvers || [], snap, geometry);
    // Maneuver latch: a parked phone's GPS wander moves along_route_m back and
    // forth across maneuver points, which used to flip the card at ~1Hz. The
    // card now holds until 3 consecutive fixes agree the driver truly passed it.
    const latched = latchedManeuverRef.current;
    const latchedAlong = Number(latched?.along_route_m);
    const candidateAlong = Number(candidate?.along_route_m);
    if (!candidate) {
      // No credible maneuver this fix — hold the card steady.
    } else if (!latched || !Number.isFinite(latchedAlong)) {
      latchedManeuverRef.current = candidate;
      maneuverAdvanceStreakRef.current = 0;
      setManeuver(candidate);
    } else if (Number.isFinite(candidateAlong) && candidateAlong > latchedAlong) {
      maneuverAdvanceStreakRef.current += 1;
      if (maneuverAdvanceStreakRef.current >= 3) {
        latchedManeuverRef.current = candidate;
        maneuverAdvanceStreakRef.current = 0;
        setManeuver(candidate);
      }
    } else {
      // Same or earlier maneuver (GPS wandered backward) — hold the card.
      maneuverAdvanceStreakRef.current = 0;
    }

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
      latchedManeuverRef.current = null;
      maneuverAdvanceStreakRef.current = 0;
      return;
    } else if (arrival.status === "arrived") {
      offRouteSamplesRef.current = 0;
      setManeuver(null);
      latchedManeuverRef.current = null;
      maneuverAdvanceStreakRef.current = 0;
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
    // Parked guard: a stationary phone's GPS drift is not a route deviation.
    // While the last several fixes haven't moved, hold the off-route counter
    // at zero so drift can't fire a reroute every cooldown window (the
    // flickering "REROUTING · CONFIRMING ROAD" loop). Displacement-based, so
    // it works even when the provider reports no speed.
    const positionWindow = positionWindowRef.current;
    if (coord && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1]))) {
      positionWindow.push({ lon: Number(coord[0]), lat: Number(coord[1]) });
      if (positionWindow.length > 6) positionWindow.shift();
    }
    const parked = positionWindow.length >= 4 && positionWindow.every((p) =>
      haversineMeters([p.lon, p.lat], [positionWindow[0].lon, positionWindow[0].lat]) < 8);
    if (acceptedSample.dead_reckoned === true) {
      // Dead-reckoned fixes keep the map moving through a tunnel/garage, but
      // never create a network reroute on their own. Wait for an absolute
      // Core Location / Fused Location Provider fix to confirm the deviation.
      offRouteSamplesRef.current = 0;
    } else if (parked) {
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

  // App-scope location session UX: acquisition is owned by lokinLocationSession
  // (started once at app launch, never stopped on page navigation). This maps
  // the session lifecycle onto the navigation status / error / waiting-detail
  // copy so every page shows the same honest state.
  const applySessionState = useCallback((s) => {
    if (!s) return;
    if (s.state === "starting") {
      setStatus("waiting_location");
      setError("");
      setWaitingDetail("");
    } else if (s.state === "waiting") {
      setWaitingDetail(s.message || "");
    } else if (s.state === "denied" || s.state === "error") {
      setStatus("error");
      setError(s.message || "LOKIN could not read the current GPS position.");
      setWaitingDetail("");
    }
    // "active" / "idle": live samples drive the UI from here.
  }, []);

  useEffect(() => {
    if (!enabled || !normalizedDestinations.length) return;
    applySessionState(getLocationSessionState());
    const onSession = (event) => applySessionState(event?.detail);
    window.addEventListener(LOCATION_SESSION_EVENT, onSession);
    return () => window.removeEventListener(LOCATION_SESSION_EVENT, onSession);
  }, [enabled, destinationsKey, normalizedDestinations.length, applySessionState]);

  // Native sample subscription (subscriber-only). The app-scope session owns
  // acquisition (permission flow, engine start/stop, warm-start drain); this
  // effect only processes live native fixes and warm-start samples for the
  // navigation pipeline and keeps the permission/runtime UX copy.
  useEffect(() => {
    if (!enabled || !normalizedDestinations.length || !nativeLocationAvailable()) return;

    const unsubscribeLocation = subscribeNativeLocation((raw) => {
      const sample = normalizeNativeLocationSample(raw);
      if (sample) {
        setWaitingDetail("");
        processLocationSample(sample, "native");
      }
    });
    // Warm-start samples arrive on the session's sample bus (the session owns
    // the queue drain); they feed the same pipeline as live native fixes.
    const onBusSample = (event) => {
      const sample = event?.detail;
      if (sample?.source === "native-warm-start") {
        setWaitingDetail("");
        processLocationSample(sample, "native");
      }
    };
    const unsubscribeError = subscribeNativeLocationError((nativeError) => {
      setStatus("error");
      setError(nativeError?.message || "LOKIN native location engine reported an error.");
    });
    const unsubscribeAuthorization = subscribeNativeLocationAuthorization((authorization) => {
      const authStatus = authorization?.status;
      if (["denied", "restricted"].includes(authStatus)) {
        setStatus("error");
        setError("Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in device Settings.");
        return;
      }
      // Unrecognized authorization string (e.g. "notDetermined"): the OS has
      // not delivered a usable decision yet. Say so instead of leaving the
      // waiting screen on its generic copy.
      if (!["always", "whenInUse"].includes(authStatus)) {
        setWaitingDetail("Waiting on your location permission — allow location for LOKIN when your device asks.");
      } else {
        setError("");
        setWaitingDetail("");
      }
    });
    const unsubscribeRuntime = subscribeNativeLocationRuntime((payload) => {
      if (payload && typeof payload === "object") setNativeRuntime(payload);
    });
    window.addEventListener(LOCATION_SAMPLE_EVENT, onBusSample);

    return () => {
      unsubscribeLocation();
      unsubscribeError();
      unsubscribeAuthorization();
      unsubscribeRuntime();
      window.removeEventListener(LOCATION_SAMPLE_EVENT, onBusSample);
    };
  }, [enabled, destinationsKey, normalizedDestinations.length, processLocationSample]);

  // Web sample subscription (subscriber-only). The app-scope session owns the
  // watchPosition registration; this effect only feeds session bus samples
  // into the navigation pipeline.
  useEffect(() => {
    if (!enabled || !normalizedDestinations.length || nativeLocationAvailable()) return;
    webFixReceivedRef.current = false;
    const onBusSample = (event) => {
      const sample = event?.detail;
      if (!sample || sample.source !== "web-geolocation") return;
      webFixReceivedRef.current = true;
      setWaitingDetail("");
      processLocationSample(sample, "web");
    };
    window.addEventListener(LOCATION_SAMPLE_EVENT, onBusSample);
    return () => window.removeEventListener(LOCATION_SAMPLE_EVENT, onBusSample);
  }, [enabled, destinationsKey, normalizedDestinations.length, processLocationSample]);

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

  // Turn-by-turn voice prompts (2026-09-27): each upcoming maneuver speaks
  // twice — an early prompt with the distance ("In a quarter mile, turn
  // right onto Colley Avenue") and an immediate one at the turn ("Turn right
  // onto Colley Avenue"). A maneuver that first appears already close skips
  // straight to the immediate prompt, and GPS jitter can never re-speak a
  // phase once it has fired.
  useEffect(() => {
    if (!voiceGuidance || !maneuver) return;
    const distance = Number(maneuver.distance_from_driver_m);
    if (!Number.isFinite(distance)) return;
    const key = `${maneuver.leg_index}:${maneuver.step_index}`;
    const instruction = maneuver?.maneuver?.instruction;
    if (!instruction) return;

    const spoken = lastSpokenRef.current;
    const phase = spoken.key === key ? spoken.phase : 0;
    let nextPhase = phase;
    // Early prompt with spoken distance.
    if (phase < 1 && distance <= 360 && distance > 90) {
      playNavCue("approach");
      speakGuidance(`In ${spokenDistance(distance)}, ${instruction}`);
      nextPhase = 1;
    }
    // Immediate prompt at the turn.
    if (nextPhase < 2 && distance <= 90) {
      playNavCue("imminent");
      speakGuidance(instruction);
      nextPhase = 2;
    }
    if (nextPhase !== phase) lastSpokenRef.current = { key, phase: nextPhase };
    // Guidance voice: gateway TTS with the driver's picked guidance voice — plays
    // inside the iOS web view where device speechSynthesis is silent.
  }, [maneuver?.leg_index, maneuver?.step_index, maneuver?.distance_from_driver_m, voiceGuidance]);

  // Arrival announcement: once per route, tell the driver which side the
  // destination is on so they find the front entrance, not the back of the block.
  useEffect(() => {
    if (status !== "arrived" || !voiceGuidance) return;
    const routeKey = route?.generated_at || "";
    if (!routeKey || arrivalAnnouncedRef.current === routeKey) return;
    arrivalAnnouncedRef.current = routeKey;
    const side = route?.destination_side;
    const atDoorPin = (geocodedDestinations || []).some((g) => g?.door_pin === true);
    const pinWord = atDoorPin ? " at your saved door pin" : "";
    const text = side === "left" || side === "right"
      ? `You have arrived${pinWord}. The destination is on your ${side}.`
      : `You have arrived${pinWord}. The destination is just ahead.`;
    speakGuidance(text);
  }, [status, voiceGuidance, route?.generated_at, route?.destination_side, geocodedDestinations]);

  const retry = useCallback(() => {
    const coord = rawPosition?.coordinate;
    if (!coord || !destinationsRef.current.length) return;
    startedKeyRef.current = destinationsRef.current.join("||");
    requestRoute(coord, destinationsRef.current, "initial");
  }, [rawPosition, requestRoute]);

  // Re-run location acquisition through the app-scope session (re-registers
  // watchPosition / re-prompts). Used by RETRY GPS when no position was ever
  // acquired (e.g. denied permission).
  const restartLocation = useCallback(() => {
    setError("");
    setWaitingDetail("");
    webFixReceivedRef.current = false;
    // A stale watch registration alone may never deliver a fresh fix — fire a
    // bounded one-shot probe as well. A success feeds the same pipeline as a
    // watch fix; a timeout only surfaces as waiting detail while still
    // waiting, never clobbering a real error state.
    reacquireLocationSession();
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

  // ETA anti-flicker: the HUD shows whole minutes that only ever tick down. A
  // higher minute value is adopted only after 4 consecutive fixes (~4s) agree,
  // so 1Hz progress jitter can't flap "4m"<->"3m" at the rounding boundary
  // while a genuine reroute's new ETA still lands promptly.
  useEffect(() => {
    const rawMin = Math.floor(Math.max(0, Number(remainingDurationS) || 0) / 60);
    const prev = etaDisplayMinRef.current;
    if (rawMin === 0) {
      // Sub-minute: every value here formats as "<1m" — already jitter-proof.
      etaDisplayMinRef.current = 0;
      etaUpStreakRef.current = 0;
      setEtaDisplayS(30);
      return;
    }
    if (prev == null || status === "arrived") {
      etaDisplayMinRef.current = rawMin;
      etaUpStreakRef.current = 0;
      setEtaDisplayS(rawMin * 60);
      return;
    }
    if (rawMin === prev) { etaUpStreakRef.current = 0; return; }
    if (rawMin < prev) {
      etaDisplayMinRef.current = rawMin;
      etaUpStreakRef.current = 0;
      setEtaDisplayS(rawMin * 60);
      return;
    }
    etaUpStreakRef.current += 1;
    if (etaUpStreakRef.current >= 4) {
      etaDisplayMinRef.current = rawMin;
      etaUpStreakRef.current = 0;
      setEtaDisplayS(rawMin * 60);
    }
  }, [remainingDurationS, status]);

  return {
    route,
    offlineRoute,
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
    remainingDurationS: etaDisplayS == null ? remainingDurationS : etaDisplayS,
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

// Direction of travel for the route request. Without it the provider may
// start the route on the opposite carriageway, so a reroute while moving
// opened with a U-turn behind the driver. Only a fresh fix taken while moving
// carries a trustworthy course; parked or stale fixes send none.
function originHeadingForRoute(sample) {
  if (!sample) return null;
  const heading = Number(sample.heading);
  const speed = Number(sample.speed_mps);
  const ageMs = Date.now() - Number(sample.timestamp || 0);
  if (sample.heading == null || !Number.isFinite(heading) || heading < 0) return null;
  if (!Number.isFinite(speed) || speed < 3) return null;
  if (!Number.isFinite(ageMs) || ageMs > 10000) return null;
  return Math.round(heading) % 360;
}
