export function logLocatorEvent(event, payload = {}) {
  try {
    console.log(`[locator] ${event}`, payload);
  } catch {
    // logging should never break UI flows
  }
}
