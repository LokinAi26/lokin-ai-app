const MAX_EVENTS = 120;
const listeners = new Set();
let state = {
  posture: "protected",
  score: 100,
  accepted: 0,
  blocked: 0,
  lastEvent: null,
  events: [],
};

function notify() { listeners.forEach((fn) => fn({ ...state, events: [...state.events] })); }
function classify(reason = "") {
  if (/host|authority|https|malformed/.test(reason)) return "critical";
  if (/unknown|duplicate|unsupported|invalid|fragment/.test(reason)) return "high";
  return "guarded";
}
function recalc() {
  const recent = state.events.slice(0, 30);
  const critical = recent.filter(e => e.severity === "critical" && !e.accepted).length;
  const high = recent.filter(e => e.severity === "high" && !e.accepted).length;
  state.score = Math.max(0, 100 - critical * 12 - high * 5);
  state.posture = state.score >= 90 ? "protected" : state.score >= 70 ? "elevated" : "defensive";
}
export function recordSecurityEvent({ accepted, reason = "accepted", source = "unknown", command = "" }) {
  const event = { id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, accepted: !!accepted, reason, source, command, severity: accepted ? "normal" : classify(reason), at: Date.now() };
  state.events = [event, ...state.events].slice(0, MAX_EVENTS);
  state.lastEvent = event;
  accepted ? state.accepted++ : state.blocked++;
  recalc(); notify(); return event;
}
export function getSecuritySnapshot() { return { ...state, events: [...state.events] }; }
export function subscribeSecurity(fn) { listeners.add(fn); fn(getSecuritySnapshot()); return () => listeners.delete(fn); }
export function securityRecommendation(snapshot = state) {
  if (snapshot.posture === "defensive") return "Keep external commands restricted and require foreground confirmation until traffic normalizes.";
  if (snapshot.posture === "elevated") return "Increase scrutiny of repeated malformed-link sources and keep destructive actions confirmation-gated.";
  return "All command gateways are operating under the current fail-closed policy.";
}
