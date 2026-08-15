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

## Next native milestone
Implement the iOS App Intents bridge in the generated native project once Base44 produces the IPA/native wrapper. The web command engine is now ready to receive those external invocations without duplicating session logic.
