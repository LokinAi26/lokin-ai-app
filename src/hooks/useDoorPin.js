import { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { normalizeAddressKey, setDoorPinMemory } from "@/lib/doorPins";

export default function useDoorPin(address = "", zipCode = "") {
  const [doorPin, setDoorPin] = useState(null);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addressKey = useMemo(() => normalizeAddressKey(address), [address]);

  const refresh = useCallback(async (opts = {}) => {
    const body = {};
    if (opts.address != null ? opts.address : address) body.address = opts.address != null ? opts.address : address;
    if (opts.zip_code != null ? opts.zip_code : zipCode) body.zip_code = opts.zip_code != null ? opts.zip_code : zipCode;

    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("getDoorPin", body);
      const payload = response?.data;
      if (Array.isArray(payload)) {
        const next = payload.map((pin) => setDoorPinMemory(pin)).filter(Boolean);
        setPins(next);
        if (addressKey) setDoorPin(next.find((pin) => normalizeAddressKey(pin?.address || pin?.display_address) === addressKey) || null);
        else setDoorPin(null);
      } else {
        const normalized = payload ? setDoorPinMemory(payload) : null;
        setDoorPin(normalized || null);
        setPins(normalized ? [normalized] : []);
      }
      return payload;
    } catch (err) {
      setError(err?.message || "Failed to fetch door pin");
      return null;
    } finally {
      setLoading(false);
    }
  }, [address, zipCode, addressKey]);

  const save = useCallback(async ({ latitude, longitude, map_x = null, map_y = null, description = "", zip_code = zipCode, targetAddress = address } = {}) => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Door pin requires finite latitude and longitude");
    const payload = {
      address: targetAddress,
      zip_code,
      latitude: lat,
      longitude: lon,
      map_x: map_x == null ? null : Number(map_x),
      map_y: map_y == null ? null : Number(map_y),
      description,
    };
    const response = await base44.functions.invoke("saveDoorPin", payload);
    const normalized = setDoorPinMemory(response?.data);
    if (normalized) {
      setDoorPin(normalized);
      setPins((prev) => {
        const key = normalizeAddressKey(normalized.address || normalized.display_address);
        const rest = prev.filter((row) => normalizeAddressKey(row?.address || row?.display_address) !== key);
        return [normalized, ...rest];
      });
    }
    return normalized;
  }, [address, zipCode]);

  useEffect(() => {
    if (!addressKey) return;
    refresh({ address });
  }, [addressKey, address, refresh]);

  return {
    doorPin,
    pins,
    loading,
    error,
    hasDoorPin: Boolean(doorPin),
    refresh,
    saveDoorPin: save,
  };
}
