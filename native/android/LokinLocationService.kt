package ai.lokin.location

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

class LokinLocationService : Service() {
    companion object {
        const val ACTION_START = "ai.lokin.location.START"
        const val ACTION_STOP = "ai.lokin.location.STOP"
        const val EXTRA_MODE = "mode"
        private const val CHANNEL_ID = "lokin_navigation"
        private const val NOTIFICATION_ID = 4401
    }

    private lateinit var fused: FusedLocationProviderClient
    private lateinit var queue: LokinLocationQueue
    private val filter = LokinLocationFilter()
    private var mode = LokinTrackingMode.ACTIVE_NAVIGATION

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.locations.forEach { raw ->
                val cleaned = filter.filter(raw, mode) ?: return@forEach
                val seq = nextSequence()
                val sample = LokinLocationSample(
                    seq = seq,
                    timestampMs = cleaned.time,
                    latitude = cleaned.latitude,
                    longitude = cleaned.longitude,
                    altitudeM = if (cleaned.hasAltitude()) cleaned.altitude else null,
                    horizontalAccuracyM = cleaned.accuracy.toDouble(),
                    speedMps = if (cleaned.hasSpeed()) cleaned.speed.toDouble() else null,
                    headingDeg = if (cleaned.hasBearing()) cleaned.bearing.toDouble() else null,
                    source = "fused"
                )
                queue.enqueue(sample)
                LokinLocationBus.publish(sample)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
        queue = LokinLocationQueue(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopTracking()
            else -> {
                mode = LokinTrackingMode.fromWire(intent?.getStringExtra(EXTRA_MODE))
                startForeground(NOTIFICATION_ID, NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("LOKIN navigation active")
                    .setContentText("Using location for live navigation")
                    .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                    .setOngoing(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .build())
                startTracking()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        fused.removeLocationUpdates(callback)
        super.onDestroy()
    }

    private fun startTracking() {
        val fine = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) {
            stopSelf()
            return
        }

        val request = if (mode == LokinTrackingMode.ACTIVE_NAVIGATION) {
            LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1_000L)
                .setMinUpdateIntervalMillis(500L)
                .setMinUpdateDistanceMeters(3f)
                .build()
        } else {
            LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 15_000L)
                .setMinUpdateIntervalMillis(5_000L)
                .setMinUpdateDistanceMeters(25f)
                .build()
        }
        filter.reset()
        fused.removeLocationUpdates(callback)
        fused.requestLocationUpdates(request, callback, mainLooper)
    }

    private fun stopTracking() {
        fused.removeLocationUpdates(callback)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun nextSequence(): Long {
        val prefs = getSharedPreferences("lokin_location", MODE_PRIVATE)
        val next = prefs.getLong("sequence", 0L) + 1L
        prefs.edit().putLong("sequence", next).apply()
        return next
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "LOKIN Navigation", NotificationManager.IMPORTANCE_LOW))
    }
}
