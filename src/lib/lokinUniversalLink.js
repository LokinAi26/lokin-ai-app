import { LOKIN_COMMANDS } from "@/lib/lokinCommandBus";

const ALLOWED = new Set(Object.values(LOKIN_COMMANDS));
const ALLOWED_KEYS = new Set(["command", "source", "nonce", "v", "q"]);
const SOURCES = new Set(["siri", "shortcut", "widget", "action-button", "watch", "spotlight", "external-link", "web"]);
const NONCE_RE = /^[A-Za-z0-9_-]{8,96}$/;
const QUERY_RE = /^[\p{L}\p{N} .,'!?&+\-]{1,120}$/u;

export function parseLokinUniversalLink(input, expectedHost) {
  let url;
  try { url = input instanceof URL ? input : new URL(input); } catch { return { ok: false, reason: "malformed_url" }; }
  if (url.protocol !== "https:") return { ok: false, reason: "https_required" };
  if (expectedHost && url.hostname !== expectedHost) return { ok: false, reason: "host_mismatch" };
  if (url.username || url.password || url.port) return { ok: false, reason: "authority_not_allowed" };
  if (url.hash) return { ok: false, reason: "fragment_not_allowed" };
  if (url.pathname !== "/command") return { ok: false, reason: "unsupported_path" };

  const seen = new Set();
  for (const [key] of url.searchParams) {
    if (!ALLOWED_KEYS.has(key)) return { ok: false, reason: "unknown_parameter" };
    if (seen.has(key)) return { ok: false, reason: "duplicate_parameter" };
    seen.add(key);
  }

  const command = url.searchParams.get("command") || "";
  const source = url.searchParams.get("source") || "external-link";
  const nonce = url.searchParams.get("nonce") || "";
  const version = url.searchParams.get("v") || "1";
  const query = url.searchParams.get("q") || "";

  if (!ALLOWED.has(command)) return { ok: false, reason: "unsupported_command" };
  if (!SOURCES.has(source)) return { ok: false, reason: "unsupported_source" };
  if (version !== "1") return { ok: false, reason: "unsupported_version" };
  if (nonce && !NONCE_RE.test(nonce)) return { ok: false, reason: "invalid_nonce" };
  if (query && !QUERY_RE.test(query)) return { ok: false, reason: "invalid_query" };
  if (command !== LOKIN_COMMANDS.ASK && query) return { ok: false, reason: "query_not_allowed" };

  return { ok: true, command, source, nonce, version, payload: query ? { phrase: query } : {} };
}

export function commandPath(command, { source = "web", nonce = "", phrase = "" } = {}) {
  if (!ALLOWED.has(command)) throw new Error("Unsupported LOKIN command");
  const params = new URLSearchParams({ command, source, v: "1" });
  if (nonce) params.set("nonce", nonce);
  if (phrase) params.set("q", phrase.slice(0, 120));
  return `/command?${params.toString()}`;
}
