import { base44 } from "@/api/base44Client";

// Offline delivery-data queue.
// When the device has no connection, delivery records (earnings, mileage,
// session logs) are stored in localStorage and flushed to the app database
// automatically as soon as the connection returns.

const QUEUE_KEY = "lokin_offline_queue";
const listeners = new Set();
let syncing = false;

function read() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — fall through with the in-memory list */
  }
}

export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function getSnapshot() {
  return { pending: read().length, syncing };
}

export function getPendingByEntity(entity) {
  return read().filter((i) => i.entity === entity);
}

export function subscribeOfflineQueue(cb) {
  listeners.add(cb);
  cb(getSnapshot());
  return () => listeners.delete(cb);
}

function emit() {
  const snap = getSnapshot();
  listeners.forEach((cb) => cb(snap));
}

// Create the record immediately when online; when offline, save it to the
// local queue so it syncs automatically once the connection returns.
export async function createOrQueue(entity, data) {
  if (isOnline()) {
    const record = await base44.entities[entity].create(data);
    return { queued: false, record };
  }
  const items = read();
  items.push({
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    entity,
    data,
    queuedAt: new Date().toISOString(),
  });
  write(items);
  emit();
  return { queued: true };
}

// Push every queued record to the database in order. Stops at the first
// failure and keeps the rest for the next online transition so no record
// is dropped or duplicated.
export async function syncOfflineQueue() {
  if (syncing || !isOnline()) return { synced: 0, remaining: read().length };
  let items = read();
  if (!items.length) return { synced: 0, remaining: 0 };

  syncing = true;
  emit();
  let synced = 0;
  try {
    while (items.length) {
      try {
        await base44.entities[items[0].entity].create(items[0].data);
        items = items.slice(1);
        write(items);
        synced += 1;
      } catch {
        break;
      }
    }
  } finally {
    syncing = false;
    emit();
  }
  return { synced, remaining: read().length };
}