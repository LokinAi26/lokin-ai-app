export const LOKIN_COMMANDS = Object.freeze({
  LOCK_IN: "lock_in",
  PAUSE: "pause",
  RESUME: "resume",
  TAP_OUT: "tap_out",
  ASK: "ask",
  FIND_ITEM: "find_item",
  SMART_SHOP: "smart_shop",
  OPEN_ROUTE: "open_route",
  SAFETY: "safety",
});

const PHRASES = {
  lock_in: "lock in",
  pause: "pause",
  resume: "resume",
  tap_out: "tap out",
  find_item: "find item",
  smart_shop: "smart shop",
  open_route: "best route",
  safety: "safety",
};

export function dispatchLokinCommand(command, payload = {}, source = "internal") {
  const phrase = PHRASES[command] || payload.phrase || command;
  window.dispatchEvent(new CustomEvent("lokin:voice-command", {
    detail: { command: phrase, commandId: command, payload, source, issuedAt: Date.now() },
  }));
}

export function externalCommandUrl(command, params = {}) {
  const search = new URLSearchParams({ lokinCommand: command, source: "external", ...params });
  return `/?${search.toString()}`;
}

export function consumeExternalCommandFromLocation() {
  const url = new URL(window.location.href);
  const command = url.searchParams.get("lokinCommand");
  if (!command) return null;
  const payload = {};
  url.searchParams.forEach((value, key) => {
    if (!["lokinCommand", "source"].includes(key)) payload[key] = value;
  });
  url.searchParams.delete("lokinCommand");
  url.searchParams.delete("source");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return { command, payload, source: "external" };
}
