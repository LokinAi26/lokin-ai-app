# LOKIN AI — Native Voice Integration (Siri & Google Assistant)

This folder contains **reference** native code that makes the LOKIN Siri
Shortcut and Google Assistant App Action integration real on a device with
the LOKIN native app installed. The Base44 platform publishes the LOKIN
React app to iOS/Android as a wrapped WebView; these files go into the
**native shell** of that wrapped app so the OS voice assistants can launch
LOKIN to a specific screen.

> These files are **not compiled or shipped by the Base44 builder** — they
> are source you (or your mobile build pipeline) port into a real Xcode /
> Android Studio project exported from the platform. They are intentionally
> minimal: the intents only OPEN the app to a deep link. All real work
> (route optimization, AI replies, earnings) runs in the React app and
> Base44 backend, so nothing is duplicated natively.

## What it enables

The native architecture now has two complementary voice paths:

1. **Foreground LOKIN Native Voice** — while the native app is open, `LOKINNativeVoiceBridge.swift.template` uses Apple Speech + AVAudioEngine to listen for “Hey LOKIN”, capture the following command, and inject it into the existing React command bus. The web app remains the single command/AI brain.
2. **System hands-free path** — when the app is backgrounded or the phone is locked, use Siri App Intents / Shortcuts. `LOKINAskIntent.swift.template` supports spoken questions such as “Hey Siri, ask LOKIN what should I do next?” and hands the question to the verified `/command` Universal Link contract.

This avoids pretending that a third-party iOS app can own a system-wide custom wake word while suspended. “Hey LOKIN” is the foreground native wake phrase; Siri is the OS-authorized background/locked-device entry point.

Once ported, a driver can say:

| Voice | Phrase | Opens |
|-------|--------|-------|
| Siri | "Optimize my LOKIN route" | `/route` |
| Siri | "Ask LOKIN" | `/lokin` |
| Siri | "Show my LOKIN earnings" | `/earnings` |
| Google Assistant | "Hey Google, optimize my LOKIN route" | `/route` |
| Google Assistant | "Hey Google, ask LOKIN" | `/lokin` |
| Google Assistant | "Hey Google, show my LOKIN earnings" | `/earnings` |

The native shell translates the voice intent into a deep link
(`lokin://<target>` on iOS, the fulfillment URL on Android) and loads the
matching LOKIN React route with `?via=siri` / `?via=assistant`. The React
app's `DeepLinkHandler` component reads that param and surfaces a brief
"Locked in" acknowledgment so the driver knows the voice launch worked.

## ChatGPT / MCP side

ChatGPT (or any MCP client) can call the `open_lokin` tool to get the exact
deep link + voice phrases for any target screen. That tool is backed by the
`native-launch` backend function and is exposed in `base44/mcp/config.json`.
So when ChatGPT says "open LOKIN via Siri," it returns a real, tappable deep
link and the exact spoken phrase — the integration is genuinely functional,
not a placeholder.

## iOS porting checklist

1. Add `native/ios/LokinIntents.swift`, `native/ios/LokinShortcuts.swift`, `native/ios/LOKINNativeVoiceBridge.swift.template`, and `native/ios/LOKINAskIntent.swift.template` to your Xcode project target (rename `.template` files to `.swift`).
2. Add the required usage descriptions to Info.plist:
   - `NSMicrophoneUsageDescription` = `LOKIN uses the microphone for hands-free voice commands.`
   - `NSSpeechRecognitionUsageDescription` = `LOKIN uses speech recognition to understand your voice commands.`
3. Instantiate `LOKINNativeVoiceBridge(webView: webView)` after creating the app's WKWebView and retain it for the lifetime of the WebView. The bridge registers the `lokinVoice` script-message channel and exposes native status/commands to `window.LOKINNativeVoice` in React.
4. Add the Associated Domains entitlement for the production LOKIN domain and keep the Universal Link validator contract synchronized with `/command`.
5. Register the custom URL scheme `lokin` in Info.plist for legacy/open-screen shortcuts:
   - `URL types` → item 0 → `URL Schemes` → item 0 = `lokin`
6. In `SceneDelegate.scene(_:openURLContexts:)` (or
   `AppDelegate.application(_:open:options:)`), map `lokin://<target>` to
   the WebView URL:
   ```swift
   func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
       guard let url = URLContexts.first?.url else { return }
       let target = url.host ?? "route"            // lokin://route -> "route"
       let map = ["route": "/route", "lokin": "/lokin", "earnings": "/earnings"]
       let path = map[target] ?? "/"
       webView.load(URL(string: "\(appBase)\(path)?action=\(target)&via=siri")!)
   }
   ```
7. Set `appBase` to your published app domain.
8. Build and run on a real device. Test both paths:
   - Foreground: enable native voice, then say “Hey LOKIN, what should I do next?”
   - Background/locked: “Hey Siri, ask LOKIN what should I do next?”

## Android porting checklist

1. Copy `native/android/actions.xml` to `app/src/main/res/xml/actions.xml`.
2. Merge `native/android/strings.xml` into `app/src/main/res/values/strings.xml`.
3. In `AndroidManifest.xml`, inside `<application>`, add:
   ```xml
   <meta-data android:name="com.google.actions"
              android:resource="@xml/actions" />
   ```
4. Replace `https://lokin-app.web.app` in `actions.xml` with your published
   app domain.
5. Ensure your WebView Activity handles the fulfillment URL (it loads the
   deep link, which the React router resolves to the right screen).
6. Test with the Google Assistant plugin in Android Studio, then on a
   device: "Hey Google, optimize my LOKIN route."

## Keeping it in sync

The voice phrases here must match the phrases returned by the `native-launch`
backend function (`base44/functions/native-launch/entry.ts`). If you change a
phrase, update both sides so ChatGPT tells the driver the same words Siri /
Google Assistant actually listen for.