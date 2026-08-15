import { LOKIN_COMMANDS } from "@/lib/lokinCommandBus";

export const LOKIN_EXTERNAL_POLICY = Object.freeze({
  [LOKIN_COMMANDS.LOCK_IN]: { allowed: true, confirmation: "none", mode: "foregroundPreferred" },
  [LOKIN_COMMANDS.PAUSE]: { allowed: true, confirmation: "none", mode: "backgroundCapable" },
  [LOKIN_COMMANDS.RESUME]: { allowed: true, confirmation: "none", mode: "backgroundCapable" },
  [LOKIN_COMMANDS.TAP_OUT]: { allowed: true, confirmation: "explicit", mode: "foregroundPreferred" },
  [LOKIN_COMMANDS.ASK]: { allowed: true, confirmation: "none", mode: "foregroundPreferred" },
  [LOKIN_COMMANDS.FIND_ITEM]: { allowed: true, confirmation: "none", mode: "foregroundPreferred" },
  [LOKIN_COMMANDS.SMART_SHOP]: { allowed: true, confirmation: "none", mode: "foregroundPreferred" },
  [LOKIN_COMMANDS.OPEN_ROUTE]: { allowed: true, confirmation: "none", mode: "foregroundPreferred" },
  [LOKIN_COMMANDS.SAFETY]: { allowed: true, confirmation: "none", mode: "foregroundPreferred" },
});

export function validateExternalCommand(command, payload = {}) {
  const policy = LOKIN_EXTERNAL_POLICY[command];
  if (!policy?.allowed) return { ok: false, reason: "unsupported_command" };
  const safePayload = {};
  Object.entries(payload || {}).slice(0, 12).forEach(([key, value]) => {
    if (/^[a-zA-Z0-9_-]{1,40}$/.test(key) && typeof value === "string" && value.length <= 240) safePayload[key] = value;
  });
  return { ok: true, policy, payload: safePayload };
}
