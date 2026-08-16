// LOKIN Intelligence Router
// Keeps deterministic/user-data commands local and reserves external AI for
// requests that genuinely benefit from reasoning. This is the authoritative
// client-side routing policy for voice/assistant requests.

const LOCAL_ROUTES = [
  { intent: "earnings", phrases: ["earnings", "how much", "made today"], to: "/earnings", reply: "Opening Earnings" },
  { intent: "home", phrases: ["go home", "home screen", "open home"], to: "/", reply: "Going Home" },
  { intent: "route", phrases: ["route", "optimize", "best route", "plan my"], to: "/route", reply: "Opening Route Optimizer" },
  { intent: "fuel", phrases: ["gas", "fuel", "find gas", "cheapest gas"], to: "/fuel", reply: "Finding Gas" },
  { intent: "break", phrases: ["break", "chill", "relax"], to: "/break-time", reply: "Opening Break Time" },
  { intent: "safety", phrases: ["safety", "sos", "emergency", "help me now"], to: "/safety", reply: "Opening Safety" },
  { intent: "support", phrases: ["support", "report a bug", "billing"], to: "/support", reply: "Opening Support" },
  { intent: "road", phrases: ["on the road", "truck stop", "rest area", "rv park"], to: "/on-the-road", reply: "Opening On The Road" },
  { intent: "vehicle", phrases: ["vehicle", "mechanic", "maintenance", "car care"], to: "/vehicle-care", reply: "Opening Vehicle Care" },
  { intent: "brand", phrases: ["brand", "merch", "apparel", "shiesty"], to: "/brand", reply: "Opening Brand" },
  { intent: "settings", phrases: ["settings", "preferences", "goals"], to: "/settings", reply: "Opening Settings" },
  { intent: "drive", phrases: ["companion", "keep me company", "road companion", "drive mode", "driving mode"], to: "/drive", reply: "Opening Drive Mode" },
  { intent: "locator", phrases: ["find item", "item locator", "locate item", "where is this item", "smart shop", "find everything"], to: "/locator", reply: "Opening Smart Shop Item Locator" },
  { intent: "shop-deliver", phrases: ["shop and deliver", "shopping orders", "shopping route"], to: "/shop-deliver", reply: "Opening Shop and Deliver" },
];

const MUSIC = [
  { phrases: ["play music", "play driving music", "start music", "play a station", "play some music"], action: "play", reply: "Playing your drive music", to: "/drive" },
  { phrases: ["pause music", "stop the music", "stop music", "pause the music"], action: "pause", reply: "Pausing the music" },
  { phrases: ["next station", "next song", "skip this", "skip song", "next track", "skip"], action: "next", reply: "Skipping to the next station" },
  { phrases: ["previous station", "last station", "previous song", "go back a station"], action: "prev", reply: "Previous station" },
];

const SESSION = [
  { intent: "level_up", phrases: ["level up", "start work", "start my shift", "begin work"] },
  { intent: "lock_in", phrases: ["lock in", "locked in", "focus mode"] },
  { intent: "pause", phrases: ["lokin pause", "pause work", "pause my shift", "pause"] },
  { intent: "resume", phrases: ["resume", "resume work", "continue work", "lock back in"] },
  { intent: "tap_out", phrases: ["tap out", "end work", "end my shift", "finish work"] },
];

function hit(text, phrases) { return phrases.some((p) => text.includes(p)); }

export function routeLokinIntelligence(command = "") {
  const text = String(command).trim().toLowerCase();
  if (!text) return { lane: "reject", reason: "empty" };

  // Specific media phrases must win over generic session words such as
  // “pause”; otherwise “pause music” could accidentally pause a work shift.
  const music = MUSIC.find((x) => hit(text, x.phrases));
  if (music) return { lane: "local-music", ...music, reason: "deterministic-media-command" };

  const session = SESSION.find((x) => hit(text, x.phrases));
  if (session) return { lane: "local-session", intent: session.intent, reason: "deterministic-session-command" };

  const nav = LOCAL_ROUTES.find((x) => hit(text, x.phrases));
  if (nav) return { lane: "local-navigation", ...nav, reason: "deterministic-navigation-command" };

  return { lane: "external-ai", mode: "assistant", reason: "reasoning-required" };
}

export function intelligenceLaneLabel(decision) {
  if (!decision) return "unknown";
  if (decision.lane === "external-ai") return "OpenAI reasoning";
  if (decision.lane === "reject") return "Rejected";
  return "LOKIN local intelligence";
}
