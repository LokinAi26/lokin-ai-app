# LOKIN AI — Native Voice + System Handoff Package

This folder contains the native iOS/Android source package that complements the Base44 React app.

## Important iOS boundary

Apple does **not** provide a public API for a third-party app to register its own always-on system/background hotword such as **“Hey LOKIN.”** The production-safe architecture is:

- **System/background entry:** Siri + App Intents / App Shortcuts.
- **Foreground LOKIN entry:** custom **“Hey LOKIN”** wake phrase while LOKIN is open.
- Siri opens the exact LOKIN deep link; the React app then becomes the fullscreen locked GPS and its own voice assistant takes over.

This package therefore gives LOKIN genuine system-level access through Apple's supported Siri/App Intents layer without claiming an unsupported custom background listener.

## iOS source files

- `native/ios/LokinIntents.swift` — production App Intents for GPS, lock in, pause, resume, tap out, assistant, and earnings.
- `native/ios/LokinShortcuts.swift` — Siri/App Shortcut phrases.
- `native/ios/LokinWebViewDeepLinkBridge.swift` — optional custom-scheme fallback bridge for a WKWebView shell.
- `native/ios/apple-app-site-association.template.json` — universal-link template.
- `native/ios/LOKINUniversalLinkValidator.swift.template` — native URL validation reference.

## System-level Siri behavior

After these files are compiled into the real iOS app target, examples include:

- “Siri, navigate with LOKIN.”
- “Siri, continue LOKIN navigation.”
- “Siri, lock in with LOKIN.”
- “Siri, pause LOKIN.”
- “Siri, resume LOKIN.”
- “Siri, tap out with LOKIN.”
- “Siri, ask LOKIN.”
- “Siri, show my LOKIN earnings.”

Navigation opens directly to:

`/ai-gps?focus=locked&nav=1&view=real&via=siri`

Once that screen is active, the React voice layer listens for **“Hey LOKIN”** and ignores ordinary ambient speech.

## Required Xcode activation

The Base44 project currently contains **no `.xcodeproj` / `.xcworkspace`**, so these Swift files are not compiled by Base44 itself. To activate them in the shipping iOS app:

1. Export/open the actual LOKIN native iOS shell in Xcode.
2. Add `LokinIntents.swift` and `LokinShortcuts.swift` to the main app target.
3. Enable **Associated Domains** and add:
   `applinks:lokin-ai-app-604c3139.base44.app`
4. Ensure the production domain serves a valid `apple-app-site-association` file for LOKIN's app/team identifiers.
5. If the shell also supports the `lokin://` custom scheme, register it under **URL Types** and use `LokinWebViewDeepLinkBridge.swift` from the shell's URL handler.
6. Build/install on a physical iPhone.
7. Open the Shortcuts app once and confirm the LOKIN App Shortcuts are discoverable.
8. Test the Siri phrases above with the app foregrounded, backgrounded, and not running.

## Safety behavior

- `tap_out` remains confirmation-protected by LOKIN's external-command policy.
- Siri only opens approved routes/commands; the web app still applies auth, command validation, and release gates.
- The native layer does not duplicate routing or AI business logic.

## Native background-safe location core

The repository now also contains a platform location package that can replace browser `navigator.geolocation` in the shipping shells while preserving it as the Base44/web fallback.

### iOS

- `native/ios/LokinLocationModels.swift`
- `native/ios/LokinLocationFilter.swift`
- `native/ios/LokinLocationQueue.swift`
- `native/ios/LokinLocationEngine.swift`
- `native/ios/LokinLocationBridge.swift`
- `native/ios/Info.location.plist.template`

The iOS location stack is now packaged by `native/ios/Package.swift` as the local Swift package `LokinLocationCore`, including SQLite linkage. Add the local package to the exported Xcode app target, enable **Background Modes → Location updates**, and merge the location privacy strings from the plist template. `LokinLocationEngine` uses `kCLLocationAccuracyBestForNavigation` only during active navigation, switches to a lower-power profile for passive mode, rejects stale/implausible fixes, fuses short outages, and writes both absolute anchors and provenance-marked estimates to the local SQLite queue.

Retain `LokinLocationShellInstaller(webView:)` for the lifetime of the trusted LOKIN WKWebView. It installs `LokinLocationBridge` against `lokin-ai-app-604c3139.base44.app`. The React hook now waits for the native authorization event before starting the engine, then automatically prefers native location while preserving browser Geolocation as the Base44/web fallback.

### Android

- `native/android/LokinLocationModels.kt`
- `native/android/LokinLocationFilter.kt`
- `native/android/LokinLocationQueue.kt`
- `native/android/LokinLocationBus.kt`
- `native/android/LokinLocationService.kt`
- `native/android/LokinLocationBridge.kt`
- `native/android/AndroidManifest.location.xml.template`

`native/android/location-core` is now an importable Android library module and declares Google Play Services Location, AndroidX Core, and the foreground-location service manifest. The exported shell can include this module directly. Retain `LokinLocationShellInstaller(activity, webView)` and call `install()` after creating the trusted WebView. The Android bridge now performs the Fine/Coarse runtime-permission handshake and publishes authorization back to React before the foreground service starts, eliminating the previous permission race. Active navigation stores both absolute anchors and provenance-marked dead-reckoned estimates in SQLite before exposing them to the UI.

### JS contract

`src/lib/nativeLocationBridge.js` defines the native command/event contract. `src/hooks/useLokinNavigation.js` now prefers native samples when the bridge is present, but remains fully functional in Base44 preview/browser environments.

The current native package intentionally queues telemetry locally. Background cloud upload should use a short-lived authenticated navigation-session upload token rather than placing a permanent Base44 or provider secret inside either app binary.

## Sensor Fusion v2.1

Sensor Fusion v2.1 extends the native location core without increasing raw GPS polling:

- `native/ios/LokinSensorFusion.swift` uses Core Motion device motion plus `CMAltimeter` around Core Location anchors. `native/android/LokinSensorFusion.kt` uses rotation-vector, linear-acceleration, and pressure sensors around Fused Location Provider anchors.
- Dead reckoning is now calibrated for bounded tunnel/garage continuity up to 20 seconds. Uncertainty grows non-linearly and confidence decays continuously; the engine stops predicting beyond the calibrated horizon rather than pretending IMU-only positioning is absolute.
- Every predicted sample now receives a real monotonic sequence number and is persisted to SQLite. It carries `authoritative=false`, `deadReckoned=true`, the originating `anchorSeq`, confidence, source, and explicit uncertainty. This preserves complete offline navigation history while keeping absolute-provider fixes distinguishable from estimates.
- `src/lib/navigationQuality.js` prevents dead-reckoned samples from triggering a network reroute by themselves. A sufficiently confident absolute Core Location/Fused Location anchor must confirm the off-route condition. Thresholds automatically widen under urban-canyon accuracy and low HMM-match confidence.
- `src/lib/navigationGeometry.js` contains the online HMM-style road matcher using distance, heading, route continuity, expected travel, and segment-jump costs to reduce parallel-road snapping.
- Low Power Mode reduces IMU duty cycle while keeping absolute navigation anchors active: iOS drops Core Motion from 50 Hz to 25 Hz, and Android uses the lower-power sensor delivery profile.
- `native/ios/Package.swift` packages the location stack as `LokinLocationCore` with SQLite linkage. `native/android/location-core` is an importable Android library module with Fused Location Provider and foreground-location service dependencies declared.
- `npm run verify:navigation` now runs HMM regression checks, tunnel/garage, urban-canyon, highway continuity, adaptive reroute checks, native-package contract verification, the production web build, and lint.
- `base44/functions/navigation-calibration-report` accepts authenticated structured field-test results. `base44/functions/navigation-telemetry-ingest` preserves authoritative/estimated counts and anchor lineage when opted-in telemetry is uploaded.

This remains a bounded fusion system, not a claim that phone IMU dead reckoning becomes absolute GNSS. The Base44 sandbox has no Xcode, Swift compiler, Android SDK, Gradle, ADB, or physical device access, so the package can be made build-ready here but the final native compile/sign/install and real road test must occur in the exported shipping shells. Do not mark physical-device validation complete until those measurements exist.

## REAL 4D navigation

The live map is powered by Mapbox road/satellite imagery and the same production route geometry used by turn-by-turn navigation. The 4D presentation is a pitched, heading-up view of real map data—not procedural terrain.

The map UI supports zoom in, zoom out, and RESET/FOLLOW so the driver can inspect the map and return to the default follow-driver visualization.
