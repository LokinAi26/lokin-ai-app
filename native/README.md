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

## REAL 4D navigation

The live map is powered by Mapbox road/satellite imagery and the same production route geometry used by turn-by-turn navigation. The 4D presentation is a pitched, heading-up view of real map data—not procedural terrain.

The map UI supports zoom in, zoom out, and RESET/FOLLOW so the driver can inspect the map and return to the default follow-driver visualization.
