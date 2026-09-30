---
name: lokin-route-audit
description: Audit LOKIN navigation and route rendering. Use for GPS, route-line, ETA, rerouting, recenter, and follow-mode work. Verifies route geometry, state lifecycle, and the locked route color.
---

# $lokin-route-audit — Route / GPS Audit

## Locked color rule

- Route line: `#A2EB1B` — canonical LOKIN navigation accent.
- App chrome, brand marks, UI accents: `#8FE44E` (LOKIN Green, the app invariant).
- `#39FF14` is brand boards/marketing only — never in app UI.

Do not substitute another green for the route line, and do not leak the route green into UI chrome.

## Verify

- **Destination correctness** — the navigated destination matches the confirmed stop.
- **Route geometry** — polyline matches the provider's geometry; no invented or smoothed segments.
- **Route-state lifecycle** — planned → active → completed/cancelled transitions; stale routes cleared, never duplicated.
- **ETA behavior** — derives from live route/session data, updates on reroute, honest when degraded.
- **Rerouting** — triggers on deviation, produces a real new route, preserves the confirmed stop set.
- **Recenter / follow-driver** — camera returns to the driver, gestures respected, no fight between manual and follow mode.
- **Permission handling** — location permission denied/degraded degrades gracefully with an actionable state.
- **Offline / error** — route data unavailable resolves to a retryable state, never an indefinite spinner.
- **Map-provider configuration** — correct tiles, keys, and style for the build environment.
- **Rendering performance** — measure before optimizing: frame rate, layer count, listener frequency, location update cadence.

## Rules

- Never invent route stops, geometry, or ETAs. Route Optimizer operates only on real confirmed stops.
- Driver safety over interaction density: verify the driver can navigate with voice + one-tap + short messages, without extended reading or typing.
- State baseline evidence before claiming any performance improvement.
