import AppIntents

// MARK: - LOKIN AI · Native Siri/App Intents
//
// Add this file to the actual iOS target that hosts LOKIN. Siri/Shortcuts is
// the system-level wake layer. Apple does not expose a public API that lets a
// third-party app register its own always-on background wake phrase such as
// "Hey LOKIN". While LOKIN is foregrounded, the React voice layer owns that
// custom wake phrase.
//
// These intents use LOKIN's production HTTPS universal links. The native app
// must include the Associated Domains entitlement for the production domain.

private enum LokinNativeURL {
    static let appBase = URL(string: "https://lokin-ai-app-604c3139.base44.app")!

    static func make(path: String, queryItems: [URLQueryItem] = []) -> URL {
        var components = URLComponents(url: appBase.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))), resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        return components.url!
    }

    static func gps(destination: String? = nil) -> URL {
        var items = [
            URLQueryItem(name: "focus", value: "locked"),
            URLQueryItem(name: "nav", value: "1"),
            URLQueryItem(name: "view", value: "real"),
            URLQueryItem(name: "via", value: "siri")
        ]
        if let destination, !destination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            items.append(URLQueryItem(name: "destination", value: destination))
        }
        return make(path: "/ai-gps", queryItems: items)
    }

    static func command(_ command: String) -> URL {
        make(path: "/command", queryItems: [
            URLQueryItem(name: "command", value: command),
            URLQueryItem(name: "via", value: "siri"),
            URLQueryItem(name: "v", value: "1")
        ])
    }
}

@available(iOS 16.0, *)
struct LokinStartNavigationIntent: AppIntent {
    static var title: LocalizedStringResource = "Start LOKIN Navigation"
    static var description = IntentDescription("Opens LOKIN directly in the locked fullscreen GPS.")

    @Parameter(title: "Destination", description: "Street address or destination for LOKIN navigation")
    var destination: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Navigate with LOKIN to \(.$destination)")
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(LokinNativeURL.gps(destination: destination)))
    }
}

@available(iOS 16.0, *)
struct LokinContinueNavigationIntent: AppIntent {
    static var title: LocalizedStringResource = "Continue LOKIN Navigation"
    static var description = IntentDescription("Returns to LOKIN's locked fullscreen GPS.")

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(LokinNativeURL.gps()))
    }
}

@available(iOS 16.0, *)
struct LokinLockInIntent: AppIntent {
    static var title: LocalizedStringResource = "Lock In with LOKIN"
    static var description = IntentDescription("Starts the LOKIN work session and opens focused GPS.")

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(LokinNativeURL.command("lock_in")))
    }
}

@available(iOS 16.0, *)
struct LokinPauseIntent: AppIntent {
    static var title: LocalizedStringResource = "Pause LOKIN"

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(LokinNativeURL.command("pause")))
    }
}

@available(iOS 16.0, *)
struct LokinResumeIntent: AppIntent {
    static var title: LocalizedStringResource = "Resume LOKIN"

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(LokinNativeURL.command("resume")))
    }
}

@available(iOS 16.0, *)
struct LokinTapOutIntent: AppIntent {
    static var title: LocalizedStringResource = "Tap Out of LOKIN"
    static var description = IntentDescription("Opens LOKIN's protected tap-out flow. LOKIN still requires confirmation before ending the session.")

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(LokinNativeURL.command("tap_out")))
    }
}

@available(iOS 16.0, *)
struct LokinAssistantIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask LOKIN"
    static var description = IntentDescription("Opens the LOKIN AI assistant.")

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(LokinNativeURL.make(path: "/lokin", queryItems: [URLQueryItem(name: "via", value: "siri")])))
    }
}

@available(iOS 16.0, *)
struct LokinEarningsIntent: AppIntent {
    static var title: LocalizedStringResource = "Show LOKIN Earnings"
    static var description = IntentDescription("Opens the LOKIN earnings dashboard.")

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(LokinNativeURL.make(path: "/earnings", queryItems: [URLQueryItem(name: "via", value: "siri")])))
    }
}
