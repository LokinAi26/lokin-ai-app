# VISION_HUD_SNAPSHOT_CONTRACT.md

Contract for the `hud_snapshot` command the web side (`src/pages/VisionHud.jsx`)
sends to the native Android XR bridge (`window.LokinVisionXR.postMessage`).

## Transport

- The web side dispatches a `lokin:vision-hud-snapshot` CustomEvent whose
  `detail` is the snapshot object below.
- `src/lib/nativeVisionXrBridge.js` forwards it **only** when
  `nativeVisionXrAvailable()` is true, via:
  `postNativeVisionXrCommand("hud_snapshot", detail)`.
- On the wire the payload is JSON: `{ "command": "hud_snapshot", ...fields }`
  (`postNativeVisionXrCommand` spreads the detail object after `command`).
- When no native bridge is present the web side sends nothing — it never
  buffers snapshots and never fakes a device.

## Fields

All nine fields are display-ready strings. A field with no real data is the
empty string `""` — never a guess, never a placeholder.

| Field                | Meaning                                              | Example / empty case            |
|----------------------|------------------------------------------------------|---------------------------------|
| `nextManeuver`       | Current maneuver instruction text                    | `"Turn left onto Atlantic Ave"` / `""` when nav inactive |
| `maneuverDistanceText` | Distance to the maneuver, formatted                | `"0.3 mi"` / `""`               |
| `stopLabel`          | Current stop label                                   | `"Stop 1 of 3 · Jane"` / `""` when no active delivery |
| `etaText`            | ETA to the current stop                              | `"12 min"` / `""`               |
| `earningsToday`      | Today's logged earnings                              | `"$86.40"` / `""`               |
| `hourlyAvgText`      | Hourly average                                       | `"$21.60/hr"` / `""`            |
| `voiceState`         | Voice pipeline state                                 | `"SPEAKING"`, `"LISTENING"`, `"THINKING"`, `"IDLE"` |
| `xrStatus`           | Pairing status from the latest telemetry record      | `"ONLINE"` only when the record says so; `""` when unpaired |
| `batteryText`        | Glasses battery                                      | `"82%"` / `""`                  |

## Kotlin-side rules (binding)

1. Render **only** these fields. Do not add, rename, or reinterpret them.
2. **Never invent values for empty fields.** An empty string means "no real
   data" — render nothing for that slot (or a neutral dash), never a
   fabricated maneuver, payout, zone, or battery level.
3. Never display an "online"/connected glasses state unless `xrStatus`
   arrived as `"ONLINE"`.
4. Treat every snapshot as a full replacement of the previous one (last-write-wins).

## Provenance

- Web producer: `src/pages/VisionHud.jsx` (snapshot `useMemo` + dispatch effect).
- Web forwarder: `src/lib/nativeVisionXrBridge.js` (`lokin:vision-hud-snapshot` listener).
- This document is the entire native-side change for this step — no Kotlin
  source was modified.
