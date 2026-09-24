const XR_STATE_EVENT = "lokin:native-vision-xr-state";

function androidXrHandler() {
  if (typeof window === "undefined") return null;
  return /** @type {any} */ (window).LokinVisionXR || null;
}

export function nativeVisionXrAvailable() {
  return Boolean(androidXrHandler()?.postMessage);
}

export function postNativeVisionXrCommand(command, payload = {}) {
  const handler = androidXrHandler();
  if (!handler?.postMessage) return false;
  try {
    handler.postMessage(JSON.stringify({ command, ...payload }));
    return true;
  } catch {
    return false;
  }
}

export function requestNativeVisionXrStatus() {
  return postNativeVisionXrCommand("status");
}

export function launchNativeVisionXr() {
  return postNativeVisionXrCommand("launch");
}

export function readNativeVisionXrState() {
  const handler = androidXrHandler();
  if (!handler?.getState) return null;
  try {
    const value = handler.getState();
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

export function subscribeNativeVisionXrState(callback) {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => callback(event.detail || null);
  window.addEventListener(XR_STATE_EVENT, listener);
  return () => window.removeEventListener(XR_STATE_EVENT, listener);
}

// Vision HUD snapshot forwarding (PROMPT-03): the VisionHud page dispatches
// `lokin:vision-hud-snapshot` with display-ready strings. Forward the snapshot
// to the native glasses bridge ONLY when a real native bridge is present.
// When nativeVisionXrAvailable() is false: do nothing — never buffer, never
// fake a device.
if (typeof window !== "undefined") {
  window.addEventListener("lokin:vision-hud-snapshot", (event) => {
    if (!nativeVisionXrAvailable()) return;
    postNativeVisionXrCommand("hud_snapshot", event?.detail || {});
  });
}
