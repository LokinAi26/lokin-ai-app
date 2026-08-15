import AppIntents
import UIKit

// MARK: - LOKIN AI · Siri Shortcut App Intents (iOS 16+)
//
// Reference implementation. Port this file into the native shell of your
// Xcode project — the part of the app that hosts the WKWebView running the
// LOKIN React web app — so Siri can launch LOKIN to a specific screen.
//
// Wiring checklist:
//   1. Register a custom URL scheme "lokin" in Info.plist:
//        URL types → Item 0 → URL Schemes → Item 0 = "lokin"
//   2. In SceneDelegate.scene(_:openURLContexts:) or
//      AppDelegate.application(_:open:options:), map incoming
//      lokin://<target> URLs to WebView URLs and load them:
//        lokin://route    -> <appUrl>/route?action=route&via=siri
//        lokin://lokin    -> <appUrl>/lokin?action=lokin&via=siri
//        lokin://earnings -> <appUrl>/earnings?action=earnings&via=siri
//      The React app reads ?via=siri and surfaces a brief acknowledgment.
//   3. Register LokinShortcuts (see LokinShortcuts.swift) so the phrases
//      appear in the Shortcuts app and respond to "Hey Siri…".
//
// These intents only OPEN the app to a deep link — all real work (route
// optimization, AI replies) runs in the React app / Base44 backend, so no
// native networking or business logic is duplicated here.

@available(iOS 16.0, *)
struct LokinRouteIntent: AppIntent {
    static var title: LocalizedStringResource = "Optimize LOKIN route"
    static var description = IntentDescription("Opens LOKIN AI and runs route optimization for your delivery offers.")
    static var openAppWhenRun: Bool = true
    static var invocationPhrase: String = "Optimize my LOKIN route"

    @MainActor
    func perform() async throws -> some IntentResult {
        UIApplication.shared.open(URL(string: "lokin://route")!, options: [:], completionHandler: nil)
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinAssistantIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask LOKIN"
    static var description = IntentDescription("Opens the LOKIN AI voice assistant.")
    static var openAppWhenRun: Bool = true
    static var invocationPhrase: String = "Ask LOKIN"

    @MainActor
    func perform() async throws -> some IntentResult {
        UIApplication.shared.open(URL(string: "lokin://lokin")!, options: [:], completionHandler: nil)
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinEarningsIntent: AppIntent {
    static var title: LocalizedStringResource = "Show LOKIN earnings"
    static var description = IntentDescription("Opens the LOKIN AI earnings dashboard.")
    static var openAppWhenRun: Bool = true
    static var invocationPhrase: String = "Show my LOKIN earnings"

    @MainActor
    func perform() async throws -> some IntentResult {
        UIApplication.shared.open(URL(string: "lokin://earnings")!, options: [:], completionHandler: nil)
        return .result()
    }
}