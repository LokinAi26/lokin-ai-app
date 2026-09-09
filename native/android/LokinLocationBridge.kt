package ai.lokin.location

import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class LokinLocationBridge(
    private val context: Context,
    private val webView: WebView,
    private val allowedHost: String
) {
    companion object {
        private const val LOCATION_PERMISSION_REQUEST = 4402
    }

    private val queue = LokinLocationQueue(context)
    private val listener: (LokinLocationSample) -> Unit = { emitLocation(it) }
    private val mainHandler = Handler(Looper.getMainLooper())
    private val activity: Activity? = context as? Activity

    init {
        LokinLocationBus.add(listener)
    }

    fun destroy() {
        LokinLocationBus.remove(listener)
        mainHandler.removeCallbacksAndMessages(null)
    }

    @JavascriptInterface
    fun postMessage(json: String) {
        if (webView.url?.let { android.net.Uri.parse(it).host }?.lowercase() != allowedHost.lowercase()) return
        val body = runCatching { JSONObject(json) }.getOrNull() ?: return
        when (body.optString("command")) {
            "requestWhenInUse" -> requestWhenInUse()
            "requestPrecise" -> requestWhenInUse()
            "runtimeStatus" -> emitRuntimeStatus()
            "requestAlways" -> {
                // Active turn-by-turn navigation does not require background
                // location permission when running as a location foreground
                // service. A future passive/background feature must present a
                // dedicated user explanation before requesting Always access.
                emitAuthorization()
            }
            "authorization" -> emitAuthorization()
            "start" -> {
                if (!hasLocationPermission()) {
                    emitError("Location permission is required before LOKIN navigation can start.")
                    requestWhenInUse()
                    return
                }
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

    private fun requestWhenInUse() {
        if (hasLocationPermission()) {
            emitAuthorization()
            return
        }
        val hostActivity = activity
        if (hostActivity == null) {
            emitError("LOKIN location permission requires an Activity-backed WebView shell.")
            return
        }
        hostActivity.runOnUiThread {
            ActivityCompat.requestPermissions(
                hostActivity,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                LOCATION_PERMISSION_REQUEST
            )
            pollAuthorization(attempt = 0)
        }
    }

    /**
     * Avoids requiring the host shell to forward onRequestPermissionsResult just
     * to start the bridge. We poll the OS permission state briefly after the
     * system dialog; the shell may still forward its own callback if desired.
     */
    private fun pollAuthorization(attempt: Int) {
        if (hasLocationPermission()) {
            emitAuthorization()
            return
        }
        if (attempt >= 100) {
            emitAuthorization()
            return
        }
        mainHandler.postDelayed({ pollAuthorization(attempt + 1) }, 300L)
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun emitRuntimeStatus() {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val serviceDeclared = runCatching {
            context.packageManager.getServiceInfo(ComponentName(context, LokinLocationService::class.java), 0)
        }.isSuccess
        val detail = JSONObject()
            .put("packageVersion", "3.0.0")
            .put("platform", "android")
            .put("motionAvailable", sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null && sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION) != null)
            .put("barometerAvailable", sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE) != null)
            .put("backgroundLocationDeclared", serviceDeclared)
            .put("bridge", "webview")
        evaluate("window.dispatchEvent(new CustomEvent('lokin:native-location-runtime',{detail:${detail}}));")
    }

    private fun emitAuthorization() {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val detail = JSONObject()
            .put("status", if (fine || coarse) "whenInUse" else "denied")
            .put("accuracy", if (fine) "full" else if (coarse) "reduced" else "none")
        evaluate("window.dispatchEvent(new CustomEvent('lokin:native-location-authorization',{detail:${detail}}));")
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

    private fun emitError(message: String) {
        val detail = JSONObject().put("message", message)
        evaluate("window.dispatchEvent(new CustomEvent('lokin:native-location-error',{detail:${detail}}));")
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
        .put("authoritative", s.authoritative)
        .put("anchorSeq", s.anchorSeq)
        .put("estimatedUncertaintyM", s.estimatedUncertaintyM)

    private fun evaluate(script: String) {
        webView.post { webView.evaluateJavascript(script, null) }
    }
}
