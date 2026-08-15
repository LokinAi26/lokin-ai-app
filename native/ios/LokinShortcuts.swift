import AppIntents

// MARK: - LOKIN AI · App Shortcuts Provider (iOS 16+)
//
// Pairs with LokinIntents.swift. Registering AppShortcuts makes the three
// LOKIN intents discoverable in the Shortcuts app and callable with
// "Hey Siri, <phrase>" without the user manually building a shortcut.
//
//   \(.applicationName) auto-resolves to the app's display name (LOKIN AI).

@available(iOS 16.0, *)
struct LokinShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LokinRouteIntent(),
            phrases: [
                "Optimize my \(.applicationName) route",
                "Open my \(.applicationName) route",
                "Run my \(.applicationName) route"
            ],
            shortTitle: "Optimize route",
            systemImageName: "point.topleft.down.curvedto.point.bottomright.up"
        )
        AppShortcut(
            intent: LokinAssistantIntent(),
            phrases: [
                "Ask \(.applicationName)",
                "Open \(.applicationName) assistant",
                "Talk to \(.applicationName)"
            ],
            shortTitle: "Ask LOKIN",
            systemImageName: "waveform"
        )
        AppShortcut(
            intent: LokinEarningsIntent(),
            phrases: [
                "Show my \(.applicationName) earnings",
                "What did I earn on \(.applicationName)",
                "\(.applicationName) earnings"
            ],
            shortTitle: "Earnings",
            systemImageName: "chart.bar.fill"
        )
    }
}