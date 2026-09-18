// LOKIN shift mileage — GPS distance accumulator for active work shifts.
// Accumulates real device-GPS distance while the driver is working, persists
// across navigation/app restarts, and hands the shift's miles to the caller
// when the shift ends so they can be logged.
const STORAGE_KEY = "lokin_shift_mileage";
const PENDING_CATEGORY_KEY = "lokin_shift_category";
const PENDING_ODO_START_KEY = "lokin_shift_odometer_start";
const MAX_ACCURACY_M = 60; // discard weak fixes entirely
const MIN_STEP_M = 6; // discard GPS jitter under ~6 m
const MAX_SPEED_MPS = 42; // discard impossible jumps (~94 mph)
const METERS_PER_MILE = 1609.344;
const MAX_PATH_POINTS = 1500; // cap on persisted trail points for the shift map

// IRS-style business mileage deduction rate ($/mile) — the single source for
// auto-log entries and the potential-tax-savings display.
export const DEDUCTION_RATE_PER_MILE = 0.7;

function haversineMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function writeState(state) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

// Tag the current (or next) shift with a delivery category, e.g. 'Food' or
// 'Grocery'. The pending key lets the Work Mode sheet set the tag before the
// session status flips to working and tracking begins.
export function setShiftCategory(category) {
  try {
    localStorage.setItem(PENDING_CATEGORY_KEY, JSON.stringify(category || null));
    const state = readState();
    if (state) writeState({ ...state, category: category || null });
  } catch {
    /* storage unavailable */
  }
}

function takePendingCategory() {
  try {
    const raw = localStorage.getItem(PENDING_CATEGORY_KEY);
    if (raw == null) return null;
    localStorage.removeItem(PENDING_CATEGORY_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Optional IRS-grade odometer reading at shift start. The Work Mode sheet sets
// it before tracking begins; the recap modal collects the end reading.
export function setShiftOdometerStart(miles) {
  try {
    const v = Number(miles);
    if (Number.isFinite(v) && v >= 0) {
      localStorage.setItem(PENDING_ODO_START_KEY, JSON.stringify(v));
      const state = readState();
      if (state) writeState({ ...state, odometerStart: v });
    } else {
      localStorage.removeItem(PENDING_ODO_START_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

function takePendingOdometerStart() {
  try {
    const raw = localStorage.getItem(PENDING_ODO_START_KEY);
    if (raw == null) return null;
    localStorage.removeItem(PENDING_ODO_START_KEY);
    const v = Number(JSON.parse(raw));
    return Number.isFinite(v) && v >= 0 ? v : null;
  } catch {
    return null;
  }
}

let watchId = null;
const listeners = new Set();

function notify() {
  const snap = getShiftSnapshot();
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      /* listener errors never break tracking */
    }
  });
}

// Append an accepted fix to the shift's driven-path trail, downsampling when
// the cap is reached so the stored polyline stays bounded.
function appendPath(path, fix) {
  let p = Array.isArray(path) ? path : [];
  if (p.length >= MAX_PATH_POINTS) p = p.filter((_, i) => i % 2 === 0);
  return [...p, [fix.lon, fix.lat]];
}

function handleFix(position) {
  const state = readState();
  if (!state) return; // shift ended between fixes
  const { latitude, longitude, accuracy } = position.coords || {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  const acc = Number(accuracy) || 0;
  if (acc > MAX_ACCURACY_M) return; // weak fix — wait for a better one
  const fix = { lat: latitude, lon: longitude, acc, t: position.timestamp || Date.now() };
  const last = state.lastFix;
  if (!last) {
    writeState({ ...state, lastFix: fix, path: appendPath(state.path, fix) });
    notify();
    return;
  }
  const distance = haversineMeters(last, fix);
  const elapsed = Math.max(1, (fix.t - last.t) / 1000);
  if (distance < Math.max(MIN_STEP_M, acc * 0.75)) return; // jitter — keep the anchor
  if (distance / elapsed > MAX_SPEED_MPS) return; // impossible jump
  writeState({ ...state, meters: (Number(state.meters) || 0) + distance, lastFix: fix, path: appendPath(state.path, fix) });
  notify();
}

function startWatch() {
  if (watchId != null) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(handleFix, () => {}, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 20000,
  });
}

function stopWatch() {
  if (watchId == null) return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export function getShiftSnapshot() {
  const state = readState();
  if (!state) return { active: false, meters: 0, miles: 0, startedAt: null, category: null };
  const meters = Number(state.meters) || 0;
  return {
    active: true,
    meters,
    miles: meters / METERS_PER_MILE,
    startedAt: state.startedAt || null,
    category: state.category || null,
    odometerStart: state.odometerStart != null ? Number(state.odometerStart) : null,
    path: Array.isArray(state.path) ? state.path : [],
  };
}

// Begin (or resume after a reload) tracking the current shift.
export function beginShiftTracking() {
  if (!readState()) writeState({ startedAt: Date.now(), meters: 0, lastFix: null, category: takePendingCategory(), odometerStart: takePendingOdometerStart() });
  startWatch();
  notify();
}

// Pause: stop the GPS watch but keep the accumulated distance for the shift.
export function suspendShiftTracking() {
  stopWatch();
  notify();
}

// End the shift. Returns the snapshot (miles accumulated) and clears state.
// When a valid odometer end reading is supplied (and a start was recorded),
// the odometer difference is the authoritative mileage (IRS-grade); the GPS
// total is kept as a cross-check.
export function endShiftTracking(odometerEnd) {
  stopWatch();
  const snap = getShiftSnapshot();
  writeState(null);
  notify();
  if (!snap.active) return null;
  const odoEnd = Number(odometerEnd);
  const odoStart = snap.odometerStart;
  let finalMiles = snap.miles;
  let milesSource = "gps";
  if (Number.isFinite(odoEnd) && odoEnd >= 0 && odoStart != null && odoEnd >= odoStart) {
    finalMiles = odoEnd - odoStart;
    milesSource = "odometer";
  }
  return { ...snap, odometerEnd: Number.isFinite(odoEnd) && odoEnd >= 0 ? odoEnd : null, finalMiles, milesSource };
}

export function subscribeShift(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}