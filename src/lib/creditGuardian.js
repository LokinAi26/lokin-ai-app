import { guardianPolicyFor } from "./creditGuardianManifest";
import { hasAiConsent } from "./aiConsent";

const CACHE_PREFIX = "lokin:guardian:";

export const CREDIT_GUARDIAN = Object.freeze({
  mode: "preservation",
  cacheMs: 5 * 60 * 1000,
  expensiveCacheMs: 15 * 60 * 1000,
  minimumRefreshMs: 60 * 1000,
});

export function getCached(key, maxAge = CREDIT_GUARDIAN.cacheMs) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value?.at || Date.now() - value.at > maxAge) return null;
    return value.data;
  } catch { return null; }
}

export function setCached(key, data) {
  try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data })); } catch {}
  return data;
}

export async function guardedCall(key, fn, { maxAge = CREDIT_GUARDIAN.cacheMs, force = false } = {}) {
  if (!force) {
    const cached = getCached(key, maxAge);
    if (cached !== null) return { data: cached, source: "guardian-cache" };
  }
  const data = await fn();
  setCached(key, data);
  return { data, source: "live" };
}

export function guardianDecision({ essential = false, userInitiated = false, cacheAvailable = false } = {}) {
  if (essential || userInitiated) return "allow";
  if (cacheAvailable) return "cache";
  return CREDIT_GUARDIAN.mode === "preservation" ? "defer" : "allow";
}

export async function guardedInvoke(base44, name, payload = {}, { force = false, userInitiated = false } = {}) {
  const policy = guardianPolicyFor(name);
  const externalAi = new Set(["external-ai-gateway", "lokinAssistant", "lokinSupport", "aiTextAssist", "learning-intelligence", "tax-advisor", "opportunity-recommend"]);
  if (externalAi.has(name) && !hasAiConsent()) {
    const err = new Error("AI processing permission is required. Enable it in LOKIN before using this AI feature.");
    err.code = "LOKIN_AI_CONSENT_REQUIRED";
    throw err;
  }
  if (policy.tier === "MISSION_CRITICAL") return base44.functions.invoke(name, payload);
  if (policy.tier === "EXTERNALIZE" && !userInitiated && CREDIT_GUARDIAN.mode === "preservation") {
    const err = new Error(`${name} deferred by LOKIN Credit Guardian preservation mode`);
    err.code = "LOKIN_CREDIT_DEFERRED";
    throw err;
  }
  const ttl = Number(policy.ttl || 0);
  if (ttl > 0) {
    const key = `${name}:${JSON.stringify(payload)}`;
    const result = await guardedCall(key, () => base44.functions.invoke(name, payload), { maxAge: ttl, force });
    return result.data;
  }
  return base44.functions.invoke(name, payload);
}
