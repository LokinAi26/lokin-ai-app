import AppIntents
import UIKit

// MARK: - LOKIN AI · Native Siri/App Intents (iOS 16+)
//
// Add this file to the actual iOS app target that hosts the LOKIN WKWebView.
// These intents provide system-level Siri/Shortcuts access. Apple does not let
// third-party apps replace the system wake phrase with a custom always-on
// "Hey LOKIN" hotword; Siri remains the system wake layer when the app is not
// active. Once LOKIN is open, the React voice layer handles "Hey LOKIN".

enum LokinDeepLink {
    static func url(host: String, queryItems: [URLQueryItem] = []) -> URL {
        var components = URLComponents()
        components.scheme = "lokin"
        components.host = host
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        return components.url!
    }

    @MainActor
    static func open(host: String, queryItems: [URLQueryItem] = []) {
        UIApplication.shared.open(url(host: host, queryItems: queryItems), options: [:], completionHandler: nil)
    }
}

@available(iOS 16.0, *)
struct LokinStartNavigationIntent: AppIntent {
    static var title: LocalizedStringResource = "Start LOKIN Navigation"
    static var description = IntentDescription("Opens LOKIN directly in the locked fullscreen GPS.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Destination", description: "Street address or destination for LOKIN navigation")
    var destination: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Navigate with LOKIN to \(.$destination)")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        var items = [
            URLQueryItem(name: "focus", value: "locked"),
            URLQueryItem(name: "nav", value: "1"),
            URLQueryItem(name: "view", value: "real")
        ]
        if let destination, !destination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            items.append(URLQueryItem(name: "destination", value: destination))
        }
        LokinDeepLink.open(host: "gps", queryItems: items)
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinContinueNavigationIntent: AppIntent {
    static var title: LocalizedStringResource = "Continue LOKIN Navigation"
    static var description = IntentDescription("Returns to LOKIN's locked fullscreen GPS.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        LokinDeepLink.open(host: "gps", queryItems: [
            URLQueryItem(name: "focus", value: "locked"),
            URLQueryItem(name: "nav", value: "1"),
            URLQueryItem(name: "view", value: "real")
        ])
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinLockInIntent: AppIntent {
    static var title: LocalizedStringResource = "Lock In with LOKIN"
    static var description = IntentDescription("Starts the LOKIN work session and opens locked GPS.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        LokinDeepLink.open(host: "command", queryItems: [URLQueryItem(name: "command", value: "lock_in")])
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinPauseIntent: AppIntent {
    static var title: LocalizedStringResource = "Pause LOKIN"
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        LokinDeepLink.open(host: "command", queryItems: [URLQueryItem(name: "command", value: "pause")])
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinResumeIntent: AppIntent {
    static var title: LocalizedStringResource = "Resume LOKIN"
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        LokinDeepLink.open(host: "command", queryItems: [URLQueryItem(name: "command", value: "resume")])
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinTapOutIntent: AppIntent {
    static var title: LocalizedStringResource = "Tap Out of LOKIN"
    static var description = IntentDescription("Opens LOKIN's protected tap-out flow. LOKIN still requires in-app confirmation before ending the session.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        LokinDeepLink.open(host: "command", queryItems: [URLQueryItem(name: "command", value: "tap_out")])
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinAssistantIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask LOKIN"
    static var description = IntentDescription("Opens the LOKIN AI assistant.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        LokinDeepLink.open(host: "assistant", queryItems: [URLQueryItem(name: "via", value: "siri")])
        return .result()
    }
}

@available(iOS 16.0, *)
struct LokinEarningsIntent: AppIntent {
    static var title: LocalizedStringResource = "Show LOKIN Earnings"
    static var description = IntentDescription("Opens the LOKIN earnings dashboard.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        LokinDeepLink.open(host: "earnings", queryItems: [URLQueryItem(name: "via", value: "siri")])
        return .result()
    }
}
