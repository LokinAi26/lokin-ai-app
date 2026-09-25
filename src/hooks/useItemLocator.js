import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { isVirginiaZipCode, normalizeZipCode } from "@/lib/virginia";
import { logLocatorEvent } from "@/lib/locatorLogger";

const DEFAULT_SYNC_POLL_MS = 15 * 60 * 1000;

export default function useItemLocator({ enabled = true, storeZipCode = "" } = {}) {
  const [geofenceResult, setGeofenceResult] = useState({ triggered: false });
  const [currentCoords, setCurrentCoords] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncStatus, setLastSyncStatus] = useState(null);
  const watchRef = useRef(null);
  const lastTriggeredStoreRef = useRef("");

  const triggerFromPosition = useCallback(async (coords) => {
    const latitude = Number(coords?.latitude);
    const longitude = Number(coords?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const payload = {
      driver_latitude: latitude,
      driver_longitude: longitude,
    };
    const zip = normalizeZipCode(storeZipCode);
    if (zip && isVirginiaZipCode(zip)) payload.store_zip_code = zip;

    const response = await base44.functions.invoke("triggerItemLocator", payload);
    const result = response?.data || { triggered: false };
    setGeofenceResult(result);
    if (result?.triggered && result?.store_name && result.store_name !== lastTriggeredStoreRef.current) {
      lastTriggeredStoreRef.current = result.store_name;
      logLocatorEvent("geofence_triggered", { store_name: result.store_name, item_count: result.item_count || 0 });
    }
    return result;
  }, [storeZipCode]);

  const reportItemLocation = useCallback(async ({ item_id, driver_latitude, driver_longitude, aisle, shelf, confidence }) => {
    const payload = {
      item_id,
      driver_latitude: Number(driver_latitude),
      driver_longitude: Number(driver_longitude),
      aisle: aisle || "",
      shelf: shelf || "",
      confidence: Number(confidence),
    };
    const response = await base44.functions.invoke("reportItemLocation", payload);
    logLocatorEvent("item_reported", { item_id, confidence: payload.confidence });
    return response?.data || null;
  }, []);

  const dismissGeofence = useCallback(() => setGeofenceResult({ triggered: false }), []);

  useEffect(() => {
    if (!enabled || !navigator?.geolocation) return undefined;
    setError("");
    setIsWatching(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentCoords({
          latitude: Number(pos?.coords?.latitude),
          longitude: Number(pos?.coords?.longitude),
        });
        triggerFromPosition(pos.coords).catch((err) => {
          setError(err?.message || "Failed to trigger item locator");
          logLocatorEvent("geofence_error", { message: err?.message || "unknown" });
        });
      },
      (geoErr) => {
        setError(geoErr?.message || "GPS unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 10000 }
    );
    return () => {
      if (watchRef.current != null && navigator?.geolocation) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      setIsWatching(false);
    };
  }, [enabled, triggerFromPosition]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const run = async () => {
      try {
        const rows = await base44.entities.LocatorItem.filter({}, "-updated_date", 200, 0);
        if (cancelled) return;
        const statuses = rows
          .map((row) => ({ store: row.store, status: row.store_api_sync_status, last_sync: row.store_api_last_sync }))
          .filter((row) => row.status);
        setLastSyncStatus(statuses);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to poll inventory sync status");
      }
    };
    run();
    const timer = window.setInterval(run, DEFAULT_SYNC_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return {
    geofenceResult,
    isWatching,
    error,
    lastSyncStatus,
    dismissGeofence,
    triggerFromPosition,
    reportItemLocation,
    currentCoords,
  };
}
