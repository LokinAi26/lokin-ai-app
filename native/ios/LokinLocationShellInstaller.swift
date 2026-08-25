import Foundation
import WebKit

/// Retain one instance for the lifetime of the trusted LOKIN WKWebView.
/// This is the only wiring the exported iOS shell needs after adding the local
/// LokinLocationCore Swift package and merging the location Info.plist keys.
@MainActor
final class LokinLocationShellInstaller {
    private let bridge: LokinLocationBridge

    init(webView: WKWebView, allowedHost: String = "lokin-ai-app-604c3139.base44.app") {
        self.bridge = LokinLocationBridge(webView: webView, allowedHost: allowedHost)
        self.bridge.install()
    }

    deinit {
        bridge.uninstall()
    }
}
