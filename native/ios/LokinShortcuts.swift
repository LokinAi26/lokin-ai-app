import AppIntents

// MARK: - LOKIN AI · App Shortcuts Provider
//
// Siri/Shortcuts is the system wake layer. Suggested phrases become available
// after these files are compiled into the real iOS target and AppShortcuts are
// registered by iOS.

@available(iOS 16.0, *)
struct LokinShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LokinStartNavigationIntent(),
            phrases: [
                "Navigate with \(.applicationName)",
                "Start \(.applicationName) navigation",
                "Open \(.applicationName) GPS"
            ],
            shortTitle: "Start navigation",
            systemImageName: "location.north.line.fill"
        )
        AppShortcut(
            intent: LokinContinueNavigationIntent(),
            phrases: [
                "Continue \(.applicationName) navigation",
                "Resume \(.applicationName) GPS",
                "Return to \(.applicationName) GPS"
            ],
            shortTitle: "Continue GPS",
            systemImageName: "car.fill"
        )
        AppShortcut(
            intent: LokinLockInIntent(),
            phrases: [
                "Lock in with \(.applicationName)",
                "Level up with \(.applicationName)",
                "Start my shift with \(.applicationName)"
            ],
            shortTitle: "Lock in",
            systemImageName: "lock.fill"
        )
        AppShortcut(
            intent: LokinPauseIntent(),
            phrases: [
                "Pause \(.applicationName)",
                "Pause my \(.applicationName) shift"
            ],
            shortTitle: "Pause",
            systemImageName: "pause.fill"
        )
        AppShortcut(
            intent: LokinResumeIntent(),
            phrases: [
                "Resume \(.applicationName)",
                "Lock back in with \(.applicationName)"
            ],
            shortTitle: "Resume",
            systemImageName: "play.fill"
        )
        AppShortcut(
            intent: LokinTapOutIntent(),
            phrases: [
                "Tap out with \(.applicationName)",
                "End my \(.applicationName) shift"
            ],
            shortTitle: "Tap out",
            systemImageName: "power"
        )
        AppShortcut(
            intent: LokinAssistantIntent(),
            phrases: [
                "Ask \(.applicationName)",
                "Talk to \(.applicationName)",
                "Open \(.applicationName) assistant"
            ],
            shortTitle: "Ask LOKIN",
            systemImageName: "waveform"
        )
        AppShortcut(
            intent: LokinEarningsIntent(),
            phrases: [
                "Show my \(.applicationName) earnings",
                "What did I earn on \(.applicationName)"
            ],
            shortTitle: "Earnings",
            systemImageName: "chart.bar.fill"
        )
    }
}