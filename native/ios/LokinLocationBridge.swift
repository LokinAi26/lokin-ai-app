import Foundation
import WebKit
import CoreLocation

@MainActor
final class LokinLocationBridge: NSObject, WKScriptMessageHandler {
    static let messageHandlerName = "lokinLocation"

    private weak var webView: WKWebView?
    private let allowedHost: String
    private let engine: LokinLocationEngine

    init(webView: WKWebView, allowedHost: String, engine: LokinLocationEngine = .shared) {
        self.webView = webView
        self.allowedHost = allowedHost.lowercased()
        self.engine = engine
        super.init()

        engine.onSample = { [weak self] sample in
            Task { @MainActor in self?.emit(event: "lokin:native-location", payload: sample) }
        }
        engine.onAuthorizationChanged = { [weak self] status, accuracy in
            let payload = AuthorizationPayload(status: Self.statusName(status), accuracy: accuracy == .fullAccuracy ? "full" : "reduced")
            Task { @MainActor in self?.emit(event: "lokin:native-location-authorization", payload: payload) }
        }
        engine.onError = { [weak self] error in
            Task { @MainActor in self?.emit(event: "lokin:native-location-error", payload: ErrorPayload(message: error.localizedDescription)) }
        }
    }

    func install() {
        webView?.configuration.userContentController.add(self, name: Self.messageHandlerName)
    }

    func uninstall() {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: Self.messageHandlerName)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.messageHandlerName else { return }
        if let host = message.frameInfo.request.url?.host?.lowercased(), host != allowedHost { return }
        guard let body = message.body as? [String: Any], let command = body["command"] as? String else { return }

        switch command {
        case "requestWhenInUse":
            engine.requestWhenInUse()
        case "requestAlways":
            engine.requestAlwaysAfterUserExplanation()
        case "requestPrecise":
            engine.requestTemporaryPreciseLocation()
        case "runtimeStatus":
            emit(event: "lokin:native-location-runtime", payload: LokinNativeRuntime.status())
        case "start":
            let rawMode = body["mode"] as? String ?? LokinTrackingMode.activeNavigation.rawValue
            let mode = LokinTrackingMode(rawValue: rawMode) ?? .activeNavigation
            engine.start(mode: mode, sessionId: body["sessionId"] as? String)
        case "stop":
            engine.stop()
        case "drain":
            let limit = body["limit"] as? Int ?? 120
            engine.readQueued(limit: limit) { [weak self] samples in
                Task { @MainActor in self?.emit(event: "lokin:native-location-queue", payload: QueuePayload(points: samples)) }
            }
        case "ack":
            if let seq = body["throughSeq"] as? NSNumber { engine.acknowledgeQueued(throughSeq: seq.int64Value) }
        default:
            break
        }
    }

    private func emit<T: Encodable>(event: String, payload: T) {
        guard let webView,
              let data = try? JSONEncoder().encode(payload),
              let json = String(data: data, encoding: .utf8),
              let eventJSON = try? JSONEncoder().encode(event),
              let eventName = String(data: eventJSON, encoding: .utf8) else { return }
        let js = "window.dispatchEvent(new CustomEvent(\(eventName), { detail: \(json) }));"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    private static func statusName(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways: return "always"
        case .authorizedWhenInUse: return "whenInUse"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    private struct AuthorizationPayload: Codable { let status: String; let accuracy: String }
    private struct ErrorPayload: Codable { let message: String }
    private struct QueuePayload: Codable { let points: [LokinLocationSample] }
}
