package ai.lokin.location

import android.content.Context
import android.content.Intent
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class LokinLocationBridge(
    private val context: Context,
    private val webView: WebView,
    private val allowedHost: String
) {
    private val queue = LokinLocationQueue(context)
    private val listener: (LokinLocationSample) -> Unit = { emitLocation(it) }

    init {
        LokinLocationBus.add(listener)
    }

    fun destroy() {
        LokinLocationBus.remove(listener)
    }

    @JavascriptInterface
    fun postMessage(json: String) {
        if (webView.url?.let { android.net.Uri.parse(it).host }?.lowercase() != allowedHost.lowercase()) return
        val body = runCatching { JSONObject(json) }.getOrNull() ?: return
        when (body.optString("command")) {
            "start" -> {
                val intent = Intent(context, LokinLocationService::class.java).apply {
                    action = LokinLocationService.ACTION_START
                    putExtra(LokinLocationService.EXTRA_MODE, body.optString("mode", "activeNavigation"))
                }
                ContextCompat.startForegroundService(context, intent)
            }
            "stop" -> context.startService(Intent(context, LokinLocationService::class.java).apply { action = LokinLocationService.ACTION_STOP })
            "drain" -> emitQueue(queue.read(body.optInt("limit", 120)))
            "ack" -> queue.acknowledge(body.optLong("throughSeq", -1L))
        }
    }

    private fun emitLocation(sample: LokinLocationSample) {
        val json = sampleJson(sample).toString()
        evaluate("window.dispatchEvent(new CustomEvent('lokin:native-location',{detail:$json}));")
    }

    private fun emitQueue(samples: List<LokinLocationSample>) {
        val array = JSONArray()
        samples.forEach { array.put(sampleJson(it)) }
        evaluate("window.dispatchEvent(new CustomEvent('lokin:native-location-queue',{detail:{points:$array}}));")
    }

    private fun sampleJson(s: LokinLocationSample) = JSONObject()
        .put("seq", s.seq)
        .put("timestampMs", s.timestampMs)
        .put("latitude", s.latitude)
        .put("longitude", s.longitude)
        .put("altitudeM", s.altitudeM)
        .put("horizontalAccuracyM", s.horizontalAccuracyM)
        .put("speedMps", s.speedMps)
        .put("headingDeg", s.headingDeg)
        .put("source", s.source)
        .put("confidence", s.confidence)
        .put("deadReckoned", s.deadReckoned)
        .put("barometricAltitudeM", s.barometricAltitudeM)

    private fun evaluate(script: String) {
        webView.post { webView.evaluateJavascript(script, null) }
    }
}
