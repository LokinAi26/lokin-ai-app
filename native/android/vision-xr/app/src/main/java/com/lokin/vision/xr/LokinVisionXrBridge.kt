package com.lokin.vision.xr

import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

internal class LokinVisionXrBridge(
    private val webView: WebView,
    private val allowedHost: String,
    private val launchProjectedActivity: () -> Unit
) {
    private val listener: (VisionXrSnapshot) -> Unit = { emitState(it) }

    init {
        LokinVisionXrState.addListener(listener)
    }

    fun destroy() {
        LokinVisionXrState.removeListener(listener)
    }

    @JavascriptInterface
    fun postMessage(json: String) {
        if (!isTrustedPage()) return
        val body = runCatching { JSONObject(json) }.getOrNull() ?: return
        when (body.optString("command")) {
            "status" -> emitState(LokinVisionXrState.current())
            "launch" -> webView.post { launchProjectedActivity() }
        }
    }

    @JavascriptInterface
    fun getState(): String {
        if (!isTrustedPage()) return "{}"
        return snapshotJson(LokinVisionXrState.current()).toString()
    }

    fun emitCurrentState() {
        emitState(LokinVisionXrState.current())
    }

    private fun emitState(snapshot: VisionXrSnapshot) {
        if (!isTrustedPage()) return
        val json = snapshotJson(snapshot).toString()
        webView.post {
            if (isTrustedPage()) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('lokin:native-vision-xr-state',{detail:$json}));",
                    null
                )
            }
        }
    }

    private fun snapshotJson(snapshot: VisionXrSnapshot) = JSONObject()
        .put("native", true)
        .put("bridge_version", "1.0.0")
        .put("runtime", "android_jetpack_xr")
        .put("compile_sdk", 37)
        .put("projected_connected", snapshot.projectedConnected)
        .put("projected_state", snapshot.projectedState)
        .put("display_category", "XR_PROJECTED")
        .put("last_error", snapshot.lastError ?: JSONObject.NULL)
        .put("updated_at_ms", snapshot.updatedAtMs)

    private fun isTrustedPage(): Boolean {
        val host = webView.url
            ?.let { runCatching { android.net.Uri.parse(it).host }.getOrNull() }
            ?.lowercase()
        return host == allowedHost.lowercase()
    }
}
