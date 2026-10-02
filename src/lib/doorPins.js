// Door-pin memory: every delivery drop-off teaches LOKIN where the actual
// door is. Pins are stored on-device (private to the driver) keyed by a
// normalized street address. Navigation resolves them before geocoding, so
// repeat deliveries route straight to the saved door instead of the map's
// generic curb point.
const STORAGE_KEY = "lokin_door_pins_v1";
const memoryPins = {};

// "123 Main St Apt 4B, Virginia Beach, VA" -> "123 main st virginia beach va"
// Unit/suite/apt designators are stripped because the door pin belongs to the
// building entrance, not the unit.
export function normalizeAddressKey(address) {
  return String(address || "")
    .toLowerCase()
    .replace(/\b(apt|apartment|unit|suite|ste|bldg|building|floor|fl|room|rm)\s*\.?\s*[a-z0-9-]+\b/g, " ")
    .replace(/#\s*[a-z0-9-]+\b/g, " ")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, " ") // ZIPs vary between data sources; street+city+state is the identity
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeAll(pins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    // Storage full or unavailable — pins simply don't persist this session.
  }
}

export function getDoorPin(address) {
  const key = normalizeAddressKey(address);
  if (!key) return null;
  return memoryPins[key] || readAll()[key] || null;
}

export function hasDoorPin(address) {
  return !!getDoorPin(address);
}

// Upsert. A manual pin (driver stood at the door) always wins over an
// auto-captured one; repeat auto captures refine toward the latest fix.
export function saveDoorPin({ address, latitude, longitude, accuracy_m = null, source = "auto", note = "" }) {
  const key = normalizeAddressKey(address);
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const pins = readAll();
  const prev = pins[key];
  pins[key] = {
    address_key: key,
    display_address: String(address || "").trim(),
    latitude: lat,
    longitude: lng,
    accuracy_m: accuracy_m == null ? null : Number(accuracy_m),
    source,
    note: String(note || "").slice(0, 200),
    confirmations: (prev?.confirmations || 0) + 1,
    created_at: prev?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // Manual pins keep their coordinates; auto captures refine the fix.
  if (prev?.source === "manual" && source === "auto") {
    pins[key].latitude = prev.latitude;
    pins[key].longitude = prev.longitude;
    pins[key].source = "manual";
  }
  writeAll(pins);
  memoryPins[key] = pins[key];
  return pins[key];
}

export function deleteDoorPin(address) {
  const key = normalizeAddressKey(address);
  if (!key) return false;
  const pins = readAll();
  if (!pins[key]) return false;
  delete pins[key];
  delete memoryPins[key];
  writeAll(pins);
  return true;
}

export function listDoorPins() {
  return Object.values({ ...readAll(), ...memoryPins }).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
}

export function doorPinCount() {
  return Object.keys(readAll()).length;
}

// High-accuracy one-shot GPS fix for pinning the door.
export function captureDoorFix(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) return reject(new Error("GPS unavailable"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? null,
      }),
      (err) => reject(new Error(err?.message || "GPS fix failed")),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 5000 },
    );
  });
}

export function setDoorPinMemory(pin) {
  const key = normalizeAddressKey(pin?.address || pin?.display_address || pin?.address_key || "");
  const lat = Number(pin?.gps_latitude ?? pin?.latitude);
  const lng = Number(pin?.gps_longitude ?? pin?.longitude);
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const normalized = {
    ...pin,
    address_key: key,
    latitude: lat,
    longitude: lng,
    updated_at: pin?.updated_at || pin?.last_updated || new Date().toISOString(),
  };
  memoryPins[key] = normalized;
  return normalized;
}
