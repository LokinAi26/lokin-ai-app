// Offline map caching (2026-09-28): basemap snapshots are kept in a small
// ring buffer so a dead zone still shows the last cached road view instead
// of a blank map. Snapshots are keyed by camera view so the SVG route and
// driver overlay stay projected against the exact image being displayed.

const MAP_KEY = "lokin_offline_maps_v1";
const MAX_CACHED_MAPS = 12;

function readAll() {
  try { return JSON.parse(localStorage.getItem(MAP_KEY)) || []; } catch { return []; }
}

function writeAll(entries) {
  try { localStorage.setItem(MAP_KEY, JSON.stringify(entries.slice(-MAX_CACHED_MAPS))); } catch { /* best-effort */ }
}

export function saveOfflineMap(viewportKey, viewport, dataUrl) {
  if (!viewportKey || !viewport || !dataUrl) return;
  const entries = readAll().filter((e) => e.key !== viewportKey);
  entries.push({ key: viewportKey, viewport, data_url: dataUrl, saved_at: Date.now() });
  writeAll(entries);
}

export function getOfflineMap(viewportKey) {
  if (!viewportKey) return null;
  return readAll().find((e) => e.key === viewportKey) || null;
}

export function getLatestOfflineMap() {
  const entries = readAll();
  return entries.length ? entries[entries.length - 1] : null;
}