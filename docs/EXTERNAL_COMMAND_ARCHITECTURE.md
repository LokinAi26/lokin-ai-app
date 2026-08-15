# LOKIN External Command Architecture

## Principle
Every external surface invokes the same semantic command IDs. Native integrations must not duplicate business logic.

External surface -> native App Intent / App Action / widget / hardware shortcut -> LOKIN deep link -> command bus -> GlobalVoiceAssistant command handler -> DriverSession / DriverPreference / navigation.

## Stable command IDs
- lock_in
- pause
- resume
- tap_out
- ask
- find_item
- smart_shop
- open_route
- safety

## Deep-link contract
`/?lokinCommand=<command_id>&source=external`

Examples:
- `/?lokinCommand=lock_in&source=external`
- `/?lokinCommand=pause&source=external`
- `/?lokinCommand=resume&source=external`
- `/?lokinCommand=tap_out&source=external`
- `/?lokinCommand=find_item&source=external`

## Apple native bridge
When the iOS shell/IPA is available, expose App Intents/App Shortcuts for Lock In, Pause, Resume, Tap Out, Find Item, and Ask LOKIN. Each intent should open or invoke the corresponding stable command ID. This makes the same actions eligible for Siri, Shortcuts, widgets/Controls, Spotlight, and supported Action-button hardware interactions.

Suggested spoken shortcuts:
- “Level up with LOKIN” -> lock_in
- “LOKIN pause” -> pause
- “LOKIN resume” -> resume
- “LOKIN tap out” -> tap_out
- “LOKIN find item” -> find_item

## Android native bridge
When the Android shell is available, map App Actions/shortcuts to the same command IDs/deep links. Use supported built-in intents where appropriate and static/dynamic shortcuts for common LOKIN actions.

## Safety rules
- External commands use semantic IDs, never arbitrary executable payloads.
- High-impact future actions (payments, account deletion, merchant financial changes) must require explicit in-app confirmation and must never be added as silent external commands.
- Driving mode keeps nonessential UI quiet; external controls should favor voice/audio confirmation.
- Commands must be idempotent where possible: pausing an already-paused session or resuming an active session should not create duplicate sessions.

## Apple App Intents implementation package
The repository now includes `native/ios/LOKINAppIntents.swift.template` and `native/ios/apple-app-site-association.template.json`. They are implementation templates for the generated Xcode/native target, not active Swift code in the current web build.

Use verified HTTPS Universal Links as the production ingress. Configure Associated Domains in Xcode and publish the AASA file on the production LOKIN domain. Keep the existing semantic command allowlist as the trust boundary. Validate all URL parameters and never permit arbitrary executable payloads.

The first App Shortcuts are Lock In, Pause, Resume, Find Item, and Tap Out. Tap Out is deliberately confirmation-gated when it arrives externally. App Shortcuts can then be surfaced by Siri, Shortcuts, Spotlight and supported Action-button workflows without creating a second business-logic implementation.

## 2026 evolution path
Apple's 2026 App Intents additions include supported execution modes/targets, cancellation and long-running behaviors, and URL-representable intents/entities. Adopt those selectively in the native target once its deployment target/Xcode toolchain is known. Do not make the Base44 web layer pretend those native APIs are active before the generated iOS target exists.

## Next native milestone
When Base44 produces the native iOS/Xcode wrapper, replace the template domain/team/bundle placeholders, enable Associated Domains, add the Swift template to the target, compile in Xcode, test cold-launch and warm-launch universal links, then verify every Siri/App Shortcut maps to the same LOKIN command bus. Add malformed-link and replay/duplicate-command tests before release.
