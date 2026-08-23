import Foundation
import WebKit

// MARK: - LOKIN AI · Native deep-link → WKWebView bridge
//
// Call `LokinWebViewDeepLinkBridge.load(url:in:appBase:)` from SceneDelegate,
// AppDelegate, or your SwiftUI URL handler whenever iOS opens a lokin:// URL.
// This keeps Siri/App Intents and the React router on one canonical contract.

enum LokinWebViewDeepLinkBridge {
    static func webPath(for url: URL) -> String {
        guard url.scheme?.lowercased() == "lokin" else { return "/" }
        let host = (url.host ?? "").lowercased()
        let incoming = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let items = incoming?.queryItems ?? []

        func value(_ name: String) -> String? {
            items.first(where: { $0.name == name })?.value
        }

        switch host {
        case "gps":
            var components = URLComponents()
            components.path = "/ai-gps"
            var query = [
                URLQueryItem(name: "focus", value: value("focus") ?? "locked"),
                URLQueryItem(name: "nav", value: value("nav") ?? "1"),
                URLQueryItem(name: "view", value: value("view") ?? "real"),
                URLQueryItem(name: "via", value: "siri")
            ]
            if let destination = value("destination"), !destination.isEmpty {
                query.append(URLQueryItem(name: "destination", value: destination))
            }
            components.queryItems = query
            return components.string ?? "/ai-gps?focus=locked&nav=1&view=real&via=siri"

        case "command":
            var components = URLComponents()
            components.path = "/command"
            components.queryItems = [
                URLQueryItem(name: "command", value: value("command") ?? "lock_in"),
                URLQueryItem(name: "via", value: "siri")
            ]
            return components.string ?? "/command?command=lock_in&via=siri"

        case "assistant":
            return "/lokin?via=siri"

        case "earnings":
            return "/earnings?via=siri"

        case "route":
            return "/route?via=siri"

        default:
            return "/?via=siri"
        }
    }

    @MainActor
    static func load(url: URL, in webView: WKWebView, appBase: URL) {
        let path = webPath(for: url)
        guard let destination = URL(string: path, relativeTo: appBase)?.absoluteURL else { return }
        webView.load(URLRequest(url: destination))
    }
}
