# M1 WP1 — localStorage Audit (SPEC-001 I6)

**Repo:** `~/workspace/builds/lokin-ai-app-fresh` — branch `m1-recoverable-shift-foundation`
**Date:** 2026-10-01
**Method:** read-only scan of all `localStorage` call sites in `src/`; every key quoted verbatim from source. No source files were modified.

**Scope:** 31 files contain the string `localStorage`. Of these, **27 files hold 45 distinct keys**; 4 files reference `localStorage` in comments only (no keys): `src/api/base44Client.js`, `src/lib/authReturnTo.js`, `src/lib/retailExtrusion.js`, `src/pages/OAuthConsent.jsx`.

**Frozen classes (SPEC-001 I6):**
| Class | Disposition |
|---|---|
| PREFERENCE / CONFIG | localStorage allowed |
| ACTIVE SHIFT STATE | migrate to IndexedDB |
| NAVIGATION RECOVERY | migrate to IndexedDB |
| EVENT / AUDIT STATE | migrate to IndexedDB |
| AUTHORIZATION STATE | never authoritative client storage |

---

## Per-file key table

### src/api/base44Client.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| *(none — comment only, line 17)* | — | — | Mentions a functions-version pin "from localStorage"; no direct calls. Auth/app-param keys flow through the `app-params` shim (see below). | — |

### src/components/FeatureTour.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_tour_seen_v1` | `"1"` once the onboarding tour has been shown | PREFERENCE / CONFIG | One-shot UI flag, not operational state. | Keep in localStorage |

### src/components/GlobalVoiceAssistant.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_always_on` | `"1"` / `"0"` always-on voice toggle | PREFERENCE / CONFIG | Driver preference. | Keep in localStorage |
| `lokin_session` | Session object: `hoursWorked` / `elapsedHours`, `platform` / `activeApp` (read-only here) | ACTIVE SHIFT STATE | Active work-session state consumed for session-derived voice context. ⚠ **NEEDS-REVIEW:** no writer found in `src/` — producer is unlocated (possibly legacy or external). Verify the producer before designing the migration. | IndexedDB (after producer verified) |

### src/components/InventoryMonitor.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_inv_threshold` | Numeric inventory alert threshold | PREFERENCE / CONFIG | Driver-configured threshold. | Keep in localStorage |

### src/components/MotivationCoach.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_thor_voice_on` | `"on"` / `"off"` pep-talk voice toggle | PREFERENCE / CONFIG | Driver preference. | Keep in localStorage |
| `lokin_thor_peptalk_conv` | Conversation ID of the current pep-talk conversation | PREFERENCE / CONFIG | Lightweight UI-state pointer, not an audit log. | Keep in localStorage |

### src/components/PrintfulStore.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `` lokin:vault:variant:${external_id} `` | Remembered product-variant selection per Shopify product | PREFERENCE / CONFIG | Commerce UI preference. | Keep in localStorage |

### src/components/RoadMatchedMap.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_map_3d_quality` | 3D map quality setting | PREFERENCE / CONFIG | Display preference. | Keep in localStorage |

### src/legacy/main.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_legacy_snapshot_v1` | Cached legacy-deck snapshot JSON (cleared on logout) | PREFERENCE / CONFIG | Dashboard display cache; not shift-operational. | Keep in localStorage |

### src/lib/aiConsent.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin:ai-processing-consent:v1` | AI-processing consent record | PREFERENCE / CONFIG | Consent/config flag. (Compliance retention of the consent *record* is a backend concern; the client flag stays.) | Keep in localStorage |

### src/lib/app-params.js (dynamic keys: `` base44_${toSnakeCase(paramName)} ``)
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `base44_access_token` | Base44 access token captured from URL param (removed from URL after capture) | AUTHORIZATION STATE | Live auth credential in client storage. Must never be authoritative; flag for the M4 security boundary. | Remove from client-authoritative storage; do not migrate to IndexedDB as a credential store |
| `token` | Legacy token key, removed alongside `base44_access_token` on clear | AUTHORIZATION STATE | Same as above. | Same as above |
| `base44_clear_access_token` | `"true"` flag triggering token purge | PREFERENCE / CONFIG | Config flag. | Keep in localStorage |
| `base44_app_id` | App ID (default from `VITE_BASE44_APP_ID`) | PREFERENCE / CONFIG | App config. | Keep in localStorage |
| `base44_from_url` | Origin URL | PREFERENCE / CONFIG | App config. | Keep in localStorage |
| `base44_functions_version` | Functions version pin | PREFERENCE / CONFIG | App config. | Keep in localStorage |
| `base44_app_base_url` | App base URL | PREFERENCE / CONFIG | App config. | Keep in localStorage |

### src/lib/authReturnTo.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| *(none — comment only, line 18)* | — | — | Warns about a crafted `returnTo` in localStorage before SDK init; no direct calls. | — |

### src/lib/doorPins.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_door_pins_v1` | Learned door coordinates keyed by normalized street address (driver-private, on-device) | PREFERENCE / CONFIG | Durable learned navigation knowledge, not shift-scoped; navigation resolves it before geocoding. Not required for shift recovery. | Keep in localStorage |

### src/lib/driverPrefsCache.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_prefs_cache_v1` | Driver preferences **plus** work-status write-through (lock-in / pause patches) | ACTIVE SHIFT STATE | Docstring: *"Voice session actions ('lock in', 'pause', …) must act instantly — they read this cache and write through on success."* The work-status payload is active shift state. ⚠ Mixed content: recommend **splitting** pure preferences from work status at migration; only the work-status portion must move. | IndexedDB (work-status portion) |
| `lokin_uid_cache_v1` | Cached `{ uid }` for DriverSession writes | PREFERENCE / CONFIG | Identity hint, not a credential/token. | Keep in localStorage |

### src/lib/lokinVoice.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_voice` | Voice URI | PREFERENCE / CONFIG | Voice preference. | Keep in localStorage |
| `lokin_voice_rate` | Speech rate | PREFERENCE / CONFIG | Voice preference. | Keep in localStorage |
| `lokin_voice_pitch` | Speech pitch | PREFERENCE / CONFIG | Voice preference. | Keep in localStorage |

### src/lib/lokinVoicePipeline.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_tts_voice` | TTS voice ID | PREFERENCE / CONFIG | Voice preference. | Keep in localStorage |
| `lokin_guidance_voice` | Guidance voice ID | PREFERENCE / CONFIG | Voice preference. | Keep in localStorage |
| `lokin_tts_volume` | TTS volume | PREFERENCE / CONFIG | Voice preference. | Keep in localStorage |

### src/lib/mapArchitect.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_landmark_view_v1` | Last map view `{ lng, lat, at }` for proximity-gated landmark loading | PREFERENCE / CONFIG | Map view state, not shift recovery data. | Keep in localStorage |

### src/lib/offerOcr.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_offer_thresholds` | OCR detection thresholds | PREFERENCE / CONFIG | Tunable config. | Keep in localStorage |

### src/lib/offlineMapCache.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_offline_maps_v1` | Basemap snapshot ring buffer (≤12 entries: viewport key, viewport, image data URL, `saved_at`) for dead-zone display | NAVIGATION RECOVERY | Exists for offline navigation resilience. Lower M1 priority than route identifiers — it is display cache, not the navigation state the recovery contract restores. | IndexedDB (deferred; not required for M1 recovery) |

### src/lib/offlineQueue.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_offline_queue` | Queued offline delivery records (earnings, mileage, session logs) pending flush to the app DB when connectivity returns | EVENT / AUDIT STATE | Immutable event/audit records awaiting sync. | IndexedDB — absorbed by the I5 idempotent event sync |

### src/lib/offlineRouteCache.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_offline_route_v1` | Current road route, maneuvers, and resolved destinations (coordinates compacted ≤6000, 24h max age) | NAVIGATION RECOVERY | Exactly the "active navigation identifiers" the I4 relaunch path must restore. | IndexedDB — **M1 priority** |

### src/lib/retailExtrusion.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| *(none — comment only, line 20)* | — | — | Notes geometry is too large for localStorage; no calls. | — |

### src/lib/shiftMileage.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_shift_mileage` | Active-shift GPS distance accumulator state (persists across navigation/app restarts; capped trail points) | ACTIVE SHIFT STATE | Core active-shift operational state; the recovery contract must reconstruct it. | IndexedDB — **M1 priority** |
| `lokin_shift_category` | Pending delivery category tag (e.g. Food/Grocery), set before tracking begins | ACTIVE SHIFT STATE | Shift-scoped operational state. | IndexedDB |
| `lokin_shift_odometer_start` | Pending odometer reading at shift start | ACTIVE SHIFT STATE | Shift-scoped operational state (recap/IRS evidence). | IndexedDB |
| `lokin_shift_presets` | Driver settings pinned for the shift until tap-out | ACTIVE SHIFT STATE | Shift-scoped operational state. | IndexedDB |

### src/lib/storeGeofence.js
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_store_cache` | OSM store data cache (24h TTL) | PREFERENCE / CONFIG | Refreshable data cache, not operational state. | Keep in localStorage |
| `lokin_store_geofence_enabled` | `"1"` / `"0"` geofence toggle | PREFERENCE / CONFIG | Driver preference. | Keep in localStorage |

### src/pages/Awareness.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_roundup` | `"1"` / `"0"` donation roundup pledge | PREFERENCE / CONFIG | Driver preference. | Keep in localStorage |
| `lokin_roundup_cause` | Chosen donation cause | PREFERENCE / CONFIG | Driver preference. | Keep in localStorage |

### src/pages/Locator.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_smart_shop` | Smart-shopping trip item list | PREFERENCE / CONFIG | User shopping list. | Keep in localStorage |

### src/pages/OAuthConsent.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| *(none — comment only, line 50)* | — | — | Discusses a stale localStorage token scenario; no calls. | — |

### src/pages/Opportunities.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_opp_filters` | Opportunity list filters | PREFERENCE / CONFIG | UI filter state. | Keep in localStorage |

### src/pages/Stash.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_green_cart` | Cannabis store cart contents | PREFERENCE / CONFIG | Commerce cart state; not shift/navigation/event/authorization. | Keep in localStorage |
| `lokin_green_age_ok` | `"1"` age-gate acknowledgment | PREFERENCE / CONFIG | One-shot UI flag. | Keep in localStorage |

### src/pages/StashCart.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_green_cart` | Same cart (shared with Stash.jsx) | PREFERENCE / CONFIG | See Stash.jsx. | Keep in localStorage |

### src/pages/VehicleCare.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_mileage` | User-entered odometer reading for maintenance tracking | PREFERENCE / CONFIG | Manual input-field persistence; distinct from the shift mileage accumulator. | Keep in localStorage |

### src/pages/VisionBridge.jsx
| Key | Stored value | Class | Justification | Migration target |
|---|---|---|---|---|
| `lokin_vision_bridge_device_id` | Persistent device ID (`vision-web-<uuid>`) | PREFERENCE / CONFIG | Device identity, not shift state. | Keep in localStorage |

---

## Summary counts by class (distinct keys)

| Class | Count | Keys |
|---|---|---|
| PREFERENCE / CONFIG | **34** | `lokin_tour_seen_v1`, `lokin_always_on`, `lokin_inv_threshold`, `lokin_thor_voice_on`, `lokin_thor_peptalk_conv`, `lokin:vault:variant:${external_id}`, `lokin_map_3d_quality`, `lokin_legacy_snapshot_v1`, `lokin:ai-processing-consent:v1`, `base44_clear_access_token`, `base44_app_id`, `base44_from_url`, `base44_functions_version`, `base44_app_base_url`, `lokin_door_pins_v1`, `lokin_uid_cache_v1`, `lokin_voice`, `lokin_voice_rate`, `lokin_voice_pitch`, `lokin_tts_voice`, `lokin_guidance_voice`, `lokin_tts_volume`, `lokin_landmark_view_v1`, `lokin_offer_thresholds`, `lokin_store_cache`, `lokin_store_geofence_enabled`, `lokin_roundup`, `lokin_roundup_cause`, `lokin_smart_shop`, `lokin_opp_filters`, `lokin_green_cart`, `lokin_green_age_ok`, `lokin_mileage`, `lokin_vision_bridge_device_id` |
| ACTIVE SHIFT STATE | **6** | `lokin_session`, `lokin_prefs_cache_v1` (work-status portion), `lokin_shift_mileage`, `lokin_shift_category`, `lokin_shift_odometer_start`, `lokin_shift_presets` |
| NAVIGATION RECOVERY | **2** | `lokin_offline_route_v1`, `lokin_offline_maps_v1` |
| EVENT / AUDIT STATE | **1** | `lokin_offline_queue` |
| AUTHORIZATION STATE | **2** | `base44_access_token`, `token` |
| **Total distinct keys** | **45** | across 27 files (4 files are comment-only) |

---

## Prioritized migration list for M1 (IndexedDB store must absorb)

Ordered by recovery-criticality for the M1 acceptance gate (force-termination → offline relaunch → equivalent active-shift state):

1. **`lokin_shift_mileage`** (`src/lib/shiftMileage.js`) — ACTIVE SHIFT STATE. The active-shift GPS distance accumulator. Without it, relaunch cannot reconstruct shift miles. **Highest priority.**
2. **`lokin_offline_route_v1`** (`src/lib/offlineRouteCache.js`) — NAVIGATION RECOVERY. Current route, maneuvers, resolved destinations — the "active navigation identifiers" the I4 relaunch path restores. **M1 priority.**
3. **`lokin_session`** (`src/components/GlobalVoiceAssistant.jsx` reads) — ACTIVE SHIFT STATE. Session hours/platform consumed across surfaces. **Blocker first: locate the writer** (no producer in `src/`), then migrate.
4. **`lokin_prefs_cache_v1`** (`src/lib/driverPrefsCache.js`) — ACTIVE SHIFT STATE (work-status portion only: lock-in/pause patches). **Split the key at migration**: pure preferences stay in localStorage; work status moves to IndexedDB.
5. **`lokin_shift_category`**, **`lokin_shift_odometer_start`**, **`lokin_shift_presets`** (`src/lib/shiftMileage.js`) — ACTIVE SHIFT STATE. Pending shift tags; migrate as a group with `lokin_shift_mileage`.
6. **`lokin_offline_queue`** (`src/lib/offlineQueue.js`) — EVENT / AUDIT STATE. Offline delivery records; absorbed by the I5 idempotent event sync (immutable `eventId`s, cursor advances only on accepted/alreadyPresent).
7. **`lokin_offline_maps_v1`** (`src/lib/offlineMapCache.js`) — NAVIGATION RECOVERY. Deferred: display cache, not required for the M1 recovery contract.

### Security finding (not a migration — a removal)
- **`base44_access_token`** and **`token`** (`src/lib/app-params.js`) are live auth credentials held in client localStorage. Per the frozen rule, authorization state must never be authoritative client storage. Do **not** migrate these to IndexedDB as a credential store; flag for remediation under the M4 consequential-action safety boundary (token lifecycle, httpOnly/session handling, and the clear-on-flag path already present).

---

## Notes and caveats
- `lokin_session` has **no writer in `src/`** (only two read sites in `GlobalVoiceAssistant.jsx`). Classified ACTIVE SHIFT STATE on the strength of its content (hours worked, active platform); the producer must be verified before migration design. Marked NEEDS-REVIEW on producer, not on class.
- `lokin_prefs_cache_v1` mixes preferences with work status; the single-class rule resolves to ACTIVE SHIFT STATE by dominant operational purpose, with a mandated split at migration time.
- `lokin_thor_peptalk_conv` stores only a conversation ID pointer; it is UI state, not an audit log — hence PREFERENCE / CONFIG.
- `lokin_door_pins_v1` is durable learned navigation knowledge but not shift-scoped and not needed for shift recovery — hence PREFERENCE / CONFIG, keep in localStorage.
- No key was invented: every key above is quoted verbatim from the source, including dynamic keys (`` lokin:vault:variant:${external_id} ``, `` base44_${paramName} `` expansion).
