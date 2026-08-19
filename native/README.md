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

1. Add `native/ios/LokinIntents.swift` and `native/ios/LokinShortcuts.swift`
   to your Xcode project target.
2. Register the custom URL scheme `lokin` in `Info.plist`:
   - `URL types` → item 0 → `URL Schemes` → item 0 = `lokin`
3. In `SceneDelegate.scene(_:openURLContexts:)` (or
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
4. Set `appBase` to your published app domain.
5. Build and run on a device (Siri Shortcuts require a real device, not the
   simulator) and test "Hey Siri, optimize my LOKIN route."

## Android porting checklist

1. Copy `native/android/actions.xml` to `app/src/main/res/xml/actions.xml`.
2. Merge `native/android/strings.xml` into `app/src/main/res/values/strings.xml`.
3. In `AndroidManifest.xml`, inside `<application>`, add:
   ```xml
   <meta-data android:name="com.google.actions"
              android:resource="@xml/actions" />
   ```
4. Confirm `actions.xml` uses the published production domain:
   `https://lokin-ai-app-604c3139.base44.app`.
5. Ensure your WebView Activity handles the fulfillment URL (it loads the
   deep link, which the React router resolves to the right screen).
6. Test with the Google Assistant plugin in Android Studio, then on a
   device: "Hey Google, optimize my LOKIN route."

## Keeping it in sync

The voice phrases here must match the phrases returned by the `native-launch`
backend function (`base44/functions/native-launch/entry.ts`). If you change a
phrase, update both sides so ChatGPT tells the driver the same words Siri /
Google Assistant actually listen for.