import { base44 } from "@/api/base44Client";

// Local-first driver-preference cache: in-memory + localStorage.
// Voice session actions ("lock in", "pause", …) must act instantly — they read
// this cache and write through on success, so a command never waits on a
// database or auth round-trip before the driver gets feedback. Writes are
// fire-and-forget safe: failures are logged, never thrown into the UI.

const PREFS_KEY = "lokin_prefs_cache_v1";
const UID_KEY = "lokin_uid_cache_v1";

let memPrefs = null; // null = not loaded yet
let memUid = null;

function readLS(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — in-memory copy still works */
  }
}

export function getCachedPrefs() {
  if (memPrefs) return memPrefs;
  memPrefs = readLS(PREFS_KEY);
  return memPrefs;
}

export function setCachedPrefs(prefs) {
  memPrefs = prefs;
  writeLS(PREFS_KEY, prefs);
}

export function invalidatePrefsCache() {
  memPrefs = null;
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch {
    /* ignore */
  }
}

// Cached user id (needed for DriverSession writes). Resolved once, then kept
// in memory + localStorage; the auth round-trip never blocks a command.
export async function getCachedUserId() {
  if (memUid) return memUid;
  const stored = readLS(UID_KEY);
  if (stored?.uid) {
    memUid = stored.uid;
    return memUid;
  }
  const me = await base44.auth.me().catch(() => null);
  if (me?.id) {
    memUid = me.id;
    writeLS(UID_KEY, { uid: me.id });
    return memUid;
  }
  return null;
}

// Write-through work-status update: the cache reflects the new status
// immediately, then the database is updated (or the row created) in the
// background. Never throws — a failed write is logged and the optimistic
// cache stands until the next successful write reconciles it.
export async function writeWorkStatus(patch) {
  const cached = getCachedPrefs();
  const id = cached?.id || null;
  try {
    if (id) {
      setCachedPrefs({ ...cached, ...patch });
      await base44.entities.DriverPreference.update(id, patch);
      return;
    }
    const list = await base44.entities.DriverPreference.filter({}).catch(() => []);
    const row = list?.[0] || null;
    if (row?.id) {
      setCachedPrefs({ ...row, ...patch });
      await base44.entities.DriverPreference.update(row.id, patch);
      return;
    }
    const created = await base44.entities.DriverPreference.create(patch);
    if (created?.id) setCachedPrefs({ ...created });
    else setCachedPrefs({ id: null, ...patch });
  } catch (e) {
    console.warn("LOKIN prefs write deferred", e?.message || e);
  }
}
