export const AI_CONSENT_KEY = "lokin:ai-processing-consent:v1";
export const AI_CONSENT_VERSION = "2026-08-19";

export function getAiConsent() {
  try { return localStorage.getItem(AI_CONSENT_KEY); } catch { return null; }
}
export function setAiConsent(value) {
  try { localStorage.setItem(AI_CONSENT_KEY, value); } catch {}
}
export function hasAiConsent() { return getAiConsent() === "granted"; }
