package ai.lokin.location

import android.app.Activity
import android.webkit.WebView

/**
 * Retain one instance for the lifetime of the trusted LOKIN WebView.
 * The exported shell calls install() after WebView creation and destroy() when
 * the Activity/WebView is torn down.
 */
class LokinLocationShellInstaller(
    activity: Activity,
    private val webView: WebView,
    allowedHost: String = "lokin-ai-app-604c3139.base44.app"
) {
    private val bridge = LokinLocationBridge(activity, webView, allowedHost)

    fun install() {
        webView.addJavascriptInterface(bridge, "LokinLocation")
    }

    fun destroy() {
        webView.removeJavascriptInterface("LokinLocation")
        bridge.destroy()
    }
}
