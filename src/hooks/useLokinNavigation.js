import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  nearestGeometryIndex,
  nextManeuverForSnap,
  prepareManeuvers,
  routeCumulativeDistances,
  snapToRoute,
} from "@/lib/navigationGeometry";

function asCoord(position) {
  if (!position?.coords) return null;
  return [Number(position.coords.longitude), Number(position.coords.latitude)];
}

function voiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
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
  const [providerProbeError, setProviderProbeError] = useState("");
  const routeRef = useRef(null);
  const geocodedRef = useRef([]);
  const destinationsRef = useRef(normalizedDestinations);
  const cumulativeRef = useRef([]);
  const routeRequestRef = useRef(0);
  const offRouteSamplesRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const lastSpokenRef = useRef("");
  const startedKeyRef = useRef("");

  useEffect(() => {
    destinationsRef.current = normalizedDestinations;
    routeRef.current = null;
    cumulativeRef.current = [];
    geocodedRef.current = [];
    startedKeyRef.current = "";
    offRouteSamplesRef.current = 0;
    lastSpokenRef.current = "";
    setRoute(null);
    setGeocodedDestinations([]);
    setSnapped(null);
    setManeuver(null);
    setRerouteCount(0);
  }, [destinationsKey]);
  useEffect(() => { routeRef.current = route; }, [route]);
  useEffect(() => { geocodedRef.current = geocodedDestinations; }, [geocodedDestinations]);

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
    }
    setStatus(reason === "initial" ? "routing" : "rerouting");
    setError("");
    try {
      const response = await base44.functions.invoke("navigation-engine", {
        action: "route_addresses",
        origin: { longitude: originCoord[0], latitude: originCoord[1] },
        destination_addresses: addresses,
        options: { profile: "driving-traffic", curbApproach: true },
      });
      if (requestId !== routeRequestRef.current) return null;
      const nextRoute = response.data?.route;
      if (!nextRoute?.geometry?.coordinates?.length) throw new Error("Routing provider returned no road geometry");
      const prepared = { ...nextRoute, maneuvers: prepareManeuvers(nextRoute) };
      routeRef.current = prepared;
      cumulativeRef.current = routeCumulativeDistances(prepared.geometry.coordinates);
      setRoute(prepared);
      const geocoded = response.data?.geocoded_destinations || [];
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

  useEffect(() => {
    if (!enabled) setStatus("idle");
    base44.functions.invoke("navigation-engine", { action: "status" })
      .then((r) => setProviderConfigured(Boolean(r.data?.configured)))
      .catch(() => setProviderConfigured(false));
  }, [enabled]);

  const probeProvider = useCallback(async () => {
    setProviderProbeError("");
    setProviderVerified(null);
    try {
      const response = await base44.functions.invoke("navigation-engine", { action: "provider_probe" });
      const verified = Boolean(response.data?.verified);
      setProviderConfigured(Boolean(response.data?.configured));
      setProviderVerified(verified);
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

  useEffect(() => {
    if (!enabled || !normalizedDestinations.length) return;
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
        const sample = {
          coordinate: coord,
          latitude: coord[1],
          longitude: coord[0],
          accuracy_m: Number(position.coords.accuracy || 0),
          heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          speed_mps: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
          timestamp: position.timestamp || Date.now(),
        };
        setRawPosition(sample);

        const key = destinationsRef.current.join("||");
        if (!routeRef.current && startedKeyRef.current !== key) {
          startedKeyRef.current = key;
          requestRoute(coord, destinationsRef.current, "initial");
          return;
        }

        const activeRoute = routeRef.current;
        const geometry = activeRoute?.geometry?.coordinates || [];
        if (!geometry.length) return;
        const snap = snapToRoute(coord, geometry, cumulativeRef.current);
        if (!snap) return;
        const enrichedSnap = { ...snap, raw_coordinate: coord, accuracy_m: sample.accuracy_m, heading: sample.heading, speed_mps: sample.speed_mps, timestamp: sample.timestamp };
        setSnapped(enrichedSnap);
        const next = nextManeuverForSnap(activeRoute.maneuvers || [], snap, geometry);
        setManeuver(next);

        const threshold = Math.max(35, Math.min(90, sample.accuracy_m * 1.5 || 35));
        if (snap.distance_m > threshold) offRouteSamplesRef.current += 1;
        else offRouteSamplesRef.current = 0;

        const now = Date.now();
        if (offRouteSamplesRef.current >= 3 && now - lastRerouteAtRef.current > 12000) {
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
      },
      (geoError) => {
        setStatus("error");
        const message = geoError?.code === 1
          ? "Location access is required for live LOKIN navigation. Enable Precise Location for LOKIN in iPhone Settings."
          : geoError?.message || "LOKIN could not read the current GPS position.";
        setError(message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, destinationsKey, requestRoute]);

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

  const remainingDistanceM = route && snapped ? Math.max(0, Number(route.distance_m || 0) * (1 - snapped.progress)) : Number(route?.distance_m || 0);
  const remainingDurationS = route && snapped ? Math.max(0, Number(route.duration_s || 0) * (1 - snapped.progress)) : Number(route?.duration_s || 0);

  return {
    route,
    rawPosition,
    snappedPosition: snapped,
    maneuver,
    status,
    error,
    retry,
    rerouteCount,
    providerConfigured,
    providerVerified,
    providerProbeError,
    probeProvider,
    remainingDistanceM,
    remainingDurationS,
    voiceSupported: voiceSupported(),
  };
}
