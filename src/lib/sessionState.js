export const SESSION_STATUS = Object.freeze({
  working: "working",
  paused: "paused",
  off: "off",
});

export function normalizeWorkStatus(value) {
  return value === SESSION_STATUS.working || value === SESSION_STATUS.paused
    ? value
    : SESSION_STATUS.off;
}

export function sessionStatusLabel(value) {
  const status = normalizeWorkStatus(value);
  if (status === SESSION_STATUS.working) return "ACTIVE";
  if (status === SESSION_STATUS.paused) return "PAUSED";
  return "GET STARTED";
}

export function resolveSessionRestoreRedirect({ workStatus, pathname, lockedGps, freeRoam }) {
  const status = normalizeWorkStatus(workStatus);

  // Paused is a session state, not a route lock. An explicit Pause action may
  // open Break Time, but restore and tab navigation must preserve the requested route.
  if (status === SESSION_STATUS.paused) return null;

  if (status === SESSION_STATUS.off && lockedGps) return "/";
  if (status === SESSION_STATUS.working && !freeRoam && pathname === "/") {
    return "/ai-gps?focus=locked&nav=1&view=real";
  }
  return null;
}
