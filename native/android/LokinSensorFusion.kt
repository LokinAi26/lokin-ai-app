package ai.lokin.location

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.os.SystemClock
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.atan2
import kotlin.math.PI

/**
 * Bounded short-horizon dead reckoning for active navigation.
 * Fused Location Provider remains the absolute anchor. IMU + pressure bridge
 * brief GNSS gaps only; prediction is confidence-bounded and stops after twenty seconds without an anchor.
 */
class LokinSensorFusion(context: Context) : SensorEventListener {
    private val appContext = context.applicationContext
    data class FusedFix(
        val location: Location,
        val confidence: Double,
        val deadReckoned: Boolean,
        val barometricAltitudeM: Double?,
        val source: String,
        val anchorSeq: Long?
    )

    private val sensors = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val rotation = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    private val linearAcceleration = sensors.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
    private val pressure = sensors.getDefaultSensor(Sensor.TYPE_PRESSURE)

    private val rotationMatrix = FloatArray(9)
    private var haveRotation = false
    private var running = false

    private var anchor: Location? = null
    private var anchorSeq: Long? = null
    private var anchorElapsedNs = 0L
    private var lastPredictionElapsedNs = 0L
    private var lastEmitElapsedNs = 0L
    private var predictedLat: Double? = null
    private var predictedLon: Double? = null
    private var velocityNorth = 0.0
    private var velocityEast = 0.0
    private var lastAnchorSpeedMps = 0.0
    private var accelerationBiasNorth = 0.0
    private var accelerationBiasEast = 0.0

    private var pressureReferenceAltitudeM: Double? = null
    private var pressureReferenceAbsoluteM: Double? = null
    private var latestBarometricAltitudeM: Double? = null

    var onPredictedFix: ((FusedFix) -> Unit)? = null

    private fun contextPowerSaveMode(): Boolean {
        val pm = appContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        return pm.isPowerSaveMode
    }

    fun start() {
        if (running) return
        running = true
        val power = contextPowerSaveMode()
        val delay = if (power) SensorManager.SENSOR_DELAY_UI else SensorManager.SENSOR_DELAY_GAME
        rotation?.let { sensors.registerListener(this, it, delay) }
        linearAcceleration?.let { sensors.registerListener(this, it, delay) }
        pressure?.let { sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
    }

    fun stop() {
        running = false
        sensors.unregisterListener(this)
        anchor = null
        anchorSeq = null
        predictedLat = null
        predictedLon = null
        velocityNorth = 0.0
        velocityEast = 0.0
        lastAnchorSpeedMps = 0.0
        accelerationBiasNorth = 0.0
        accelerationBiasEast = 0.0
        haveRotation = false
        pressureReferenceAltitudeM = null
        pressureReferenceAbsoluteM = null
        latestBarometricAltitudeM = null
    }

    fun ingestAnchor(location: Location, anchorSeq: Long? = null) {
        val speed = if (location.hasSpeed()) max(location.speed.toDouble(), 0.0) else 0.0
        val headingRad = if (location.hasBearing()) location.bearing.toDouble() * PI / 180.0 else 0.0
        anchor = Location(location)
        this.anchorSeq = anchorSeq
        anchorElapsedNs = SystemClock.elapsedRealtimeNanos()
        lastPredictionElapsedNs = anchorElapsedNs
        predictedLat = location.latitude
        predictedLon = location.longitude
        lastAnchorSpeedMps = speed
        velocityNorth = speed * cos(headingRad)
        velocityEast = speed * sin(headingRad)
        if (speed < 0.7) {
            velocityNorth = 0.0
            velocityEast = 0.0
        }
        if (location.hasAltitude()) pressureReferenceAltitudeM = location.altitude
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!running) return
        when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> {
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
                haveRotation = true
            }
            Sensor.TYPE_PRESSURE -> {
                val absolute = SensorManager.getAltitude(SensorManager.PRESSURE_STANDARD_ATMOSPHERE, event.values[0]).toDouble()
                if (pressureReferenceAbsoluteM == null) pressureReferenceAbsoluteM = absolute
                val refAbsolute = pressureReferenceAbsoluteM
                val refAltitude = pressureReferenceAltitudeM
                if (refAbsolute != null && refAltitude != null) {
                    latestBarometricAltitudeM = refAltitude + (absolute - refAbsolute)
                }
            }
            Sensor.TYPE_LINEAR_ACCELERATION -> consumeAcceleration(event.values)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun consumeAcceleration(values: FloatArray) {
        val base = anchor ?: return
        val lat0 = predictedLat ?: return
        val lon0 = predictedLon ?: return
        val nowNs = SystemClock.elapsedRealtimeNanos()
        val ageS = (nowNs - anchorElapsedNs) / 1_000_000_000.0
        val maxDeadReckoningAgeS = 20.0
        if (ageS < 0.60 || ageS > maxDeadReckoningAgeS) {
            lastPredictionElapsedNs = nowNs
            return
        }

        val dt = min(0.10, max(0.005, (nowNs - lastPredictionElapsedNs) / 1_000_000_000.0))
        lastPredictionElapsedNs = nowNs

        var eastAcceleration = 0.0
        var northAcceleration = 0.0
        if (haveRotation) {
            // Android world frame uses X east and Y magnetic north after the
            // rotation-vector transform. Clamp hard to suppress sensor spikes.
            eastAcceleration = (rotationMatrix[0] * values[0] + rotationMatrix[1] * values[1] + rotationMatrix[2] * values[2]).toDouble()
            northAcceleration = (rotationMatrix[3] * values[0] + rotationMatrix[4] * values[1] + rotationMatrix[5] * values[2]).toDouble()
            eastAcceleration = max(-6.0, min(6.0, eastAcceleration))
            northAcceleration = max(-6.0, min(6.0, northAcceleration))
        }

        val rawEastAcceleration = eastAcceleration
        val rawNorthAcceleration = northAcceleration
        val rawAccelerationMagnitude = hypot(rawNorthAcceleration, rawEastAcceleration)
        if (lastAnchorSpeedMps < 1.2 && rawAccelerationMagnitude < 0.55) {
            val alpha = min(0.06, max(0.005, dt * 0.8))
            accelerationBiasNorth = accelerationBiasNorth * (1.0 - alpha) + rawNorthAcceleration * alpha
            accelerationBiasEast = accelerationBiasEast * (1.0 - alpha) + rawEastAcceleration * alpha
        }

        northAcceleration = max(-6.0, min(6.0, rawNorthAcceleration - accelerationBiasNorth))
        eastAcceleration = max(-6.0, min(6.0, rawEastAcceleration - accelerationBiasEast))

        velocityNorth += northAcceleration * dt
        velocityEast += eastAcceleration * dt
        if (lastAnchorSpeedMps < 0.8 && hypot(northAcceleration, eastAcceleration) < 0.22 && ageS < 4.0) {
            val damping = exp(-5.0 * dt)
            velocityNorth *= damping
            velocityEast *= damping
            if (hypot(velocityNorth, velocityEast) < 0.25) {
                velocityNorth = 0.0
                velocityEast = 0.0
            }
        }
        val speed = hypot(velocityNorth, velocityEast)
        if (speed > 75.0) {
            val scale = 75.0 / speed
            velocityNorth *= scale
            velocityEast *= scale
        }

        var lat = lat0 + (velocityNorth * dt) / 111_132.0
        val lonMetersPerDegree = max(10_000.0, 111_320.0 * cos(lat * PI / 180.0))
        var lon = lon0 + (velocityEast * dt) / lonMetersPerDegree
        predictedLat = lat
        predictedLon = lon

        if ((nowNs - lastEmitElapsedNs) < 100_000_000L) return
        lastEmitElapsedNs = nowNs

        val dynamicsPenalty = min(28.0, hypot(northAcceleration, eastAcceleration) * ageS * 0.55)
        val uncertainty = min(220.0, max(base.accuracy.toDouble(), 4.0) + ageS * 5.5 + ageS * ageS * 0.20 + dynamicsPenalty)
        val confidence = max(0.03, min(0.98, exp(-ageS / 8.0) * exp(-uncertainty / 180.0)))
        val heading = (atan2(velocityEast, velocityNorth) * 180.0 / PI + 360.0) % 360.0
        val predicted = Location("lokin-dead-reckoning").apply {
            latitude = lat
            longitude = lon
            accuracy = uncertainty.toFloat()
            time = System.currentTimeMillis()
            elapsedRealtimeNanos = nowNs
            speed = hypot(velocityNorth, velocityEast).toFloat()
            bearing = heading.toFloat()
            latestBarometricAltitudeM?.let { altitude = it }
        }
        onPredictedFix?.invoke(FusedFix(
            location = predicted,
            confidence = confidence,
            deadReckoned = true,
            barometricAltitudeM = latestBarometricAltitudeM,
            source = "fused+imu+barometer-dead-reckoning",
            anchorSeq = anchorSeq
        ))
    }
}
