package ai.lokin.location

import android.location.Location
import kotlin.math.max

class LokinLocationFilter {
    private var lastAccepted: Location? = null
    private var filteredLat: Double? = null
    private var filteredLon: Double? = null

    fun reset() {
        lastAccepted = null
        filteredLat = null
        filteredLon = null
    }

    fun filter(raw: Location, mode: LokinTrackingMode): Location? {
        val ageMs = kotlin.math.abs(System.currentTimeMillis() - raw.time)
        if (ageMs > 15_000L || !raw.hasAccuracy() || raw.accuracy <= 0f) return null

        val maxAccuracy = if (mode == LokinTrackingMode.ACTIVE_NAVIGATION) 80f else 150f
        if (raw.accuracy > maxAccuracy) return null

        lastAccepted?.let { previous ->
            val dt = max(0.1, (raw.time - previous.time) / 1000.0)
            val distance = raw.distanceTo(previous).toDouble()
            val impliedSpeed = distance / dt
            val reported = max(if (raw.hasSpeed()) raw.speed.toDouble() else 0.0, if (previous.hasSpeed()) previous.speed.toDouble() else 0.0)
            val ceiling = max(65.0, reported + 20.0)
            if (impliedSpeed > ceiling && distance > max(35.0, raw.accuracy * 2.0)) return null
        }

        val alpha = when {
            mode != LokinTrackingMode.ACTIVE_NAVIGATION -> 0.25
            raw.accuracy <= 8f -> 0.80
            raw.accuracy <= 20f -> 0.60
            else -> 0.40
        }

        filteredLat = filteredLat?.let { it + alpha * (raw.latitude - it) } ?: raw.latitude
        filteredLon = filteredLon?.let { it + alpha * (raw.longitude - it) } ?: raw.longitude

        return Location(raw).apply {
            latitude = filteredLat!!
            longitude = filteredLon!!
        }.also { lastAccepted = it }
    }
}
