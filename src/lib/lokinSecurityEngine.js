const MAX_EVENTS = 160;
const WINDOW_MS = 5 * 60 * 1000;
const listeners = new Set();
let state = { posture: "protected", score: 100, accepted: 0, blocked: 0, lastEvent: null, events: [], adaptiveMode: "normal" };

function notify() { listeners.forEach((fn) => fn(getSecuritySnapshot())); }
function classify(reason = "") {
  if (/host|authority|https|malformed|credential|port/.test(reason)) return "critical";
  if (/unknown|duplicate|unsupported|invalid|fragment|required|replay/.test(reason)) return "high";
  return "guarded";
}
function recalc() {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = state.events.filter(e => e.at >= cutoff).slice(0, 60);
  const critical = recent.filter(e => e.severity === "critical" && !e.accepted).length;
  const high = recent.filter(e => e.severity === "high" && !e.accepted).length;
  const blocked = recent.filter(e => !e.accepted).length;
  state.score = Math.max(0, 100 - Math.min(48, critical * 12) - Math.min(35, high * 5) - Math.min(15, Math.max(0, blocked - 4)));
  state.posture = state.score >= 90 ? "protected" : state.score >= 70 ? "elevated" : "defensive";
  state.adaptiveMode = state.posture === "defensive" ? "lockdown" : state.posture === "elevated" ? "hardened" : "normal";
}
export function recordSecurityEvent({ accepted, reason = "accepted", source = "unknown", command = "" }) {
  const event = { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, accepted: !!accepted, reason, source, command, severity: accepted ? "normal" : classify(reason), at: Date.now() };
  state.events = [event, ...state.events].slice(0, MAX_EVENTS); state.lastEvent = event;
  accepted ? state.accepted++ : state.blocked++; recalc(); notify(); return event;
}
export function getSecuritySnapshot() { recalc(); return { ...state, events: [...state.events] }; }
export function subscribeSecurity(fn) { listeners.add(fn); fn(getSecuritySnapshot()); return () => listeners.delete(fn); }
export function securityDecision({ command = "", confirmation = "none" } = {}) {
  const s = getSecuritySnapshot();
  if (s.adaptiveMode === "lockdown" && !["safety", "pause"].includes(command)) return { allow: false, reason: "adaptive_lockdown" };
  if (s.adaptiveMode === "hardened" && confirmation === "none" && ["lock_in", "resume", "ask"].includes(command)) return { allow: true, requireConfirmation: true, reason: "adaptive_confirmation" };
  return { allow: true, requireConfirmation: confirmation === "explicit", reason: "policy" };
}
export function securityRecommendation(snapshot = getSecuritySnapshot()) {
  if (snapshot.posture === "defensive") return "Lockdown is active: only safety and pause ingress remain automatic while suspicious traffic cools down.";
  if (snapshot.posture === "elevated") return "Hardened mode is active: higher-impact external commands receive extra confirmation.";
  return "Sentinel is protected: fail-closed validation, command policy, and adaptive monitoring are active.";
}
