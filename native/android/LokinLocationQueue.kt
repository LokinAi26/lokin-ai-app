package ai.lokin.location

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

class LokinLocationQueue(context: Context) : SQLiteOpenHelper(context, "lokin-location.sqlite3", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE location_queue(seq INTEGER PRIMARY KEY, created_at_ms INTEGER NOT NULL, payload TEXT NOT NULL)")
        db.execSQL("CREATE INDEX idx_location_queue_created ON location_queue(created_at_ms)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    @Synchronized
    fun enqueue(sample: LokinLocationSample) {
        val json = JSONObject()
            .put("seq", sample.seq)
            .put("timestampMs", sample.timestampMs)
            .put("latitude", sample.latitude)
            .put("longitude", sample.longitude)
            .put("altitudeM", sample.altitudeM)
            .put("horizontalAccuracyM", sample.horizontalAccuracyM)
            .put("speedMps", sample.speedMps)
            .put("headingDeg", sample.headingDeg)
            .put("source", sample.source)
            .put("confidence", sample.confidence)
            .put("deadReckoned", sample.deadReckoned)
            .put("barometricAltitudeM", sample.barometricAltitudeM)
            .put("authoritative", sample.authoritative)
            .put("anchorSeq", sample.anchorSeq)
            .put("estimatedUncertaintyM", sample.estimatedUncertaintyM)
            .toString()

        val values = ContentValues().apply {
            put("seq", sample.seq)
            put("created_at_ms", sample.timestampMs)
            put("payload", json)
        }
        writableDatabase.insertWithOnConflict("location_queue", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized
    fun read(limit: Int = 120): List<LokinLocationSample> {
        val safeLimit = limit.coerceIn(1, 500)
        val out = mutableListOf<LokinLocationSample>()
        readableDatabase.rawQuery("SELECT payload FROM location_queue ORDER BY seq ASC LIMIT ?", arrayOf(safeLimit.toString())).use { cursor ->
            while (cursor.moveToNext()) {
                val o = JSONObject(cursor.getString(0))
                out += LokinLocationSample(
                    seq = o.getLong("seq"),
                    timestampMs = o.getLong("timestampMs"),
                    latitude = o.getDouble("latitude"),
                    longitude = o.getDouble("longitude"),
                    altitudeM = if (o.isNull("altitudeM")) null else o.getDouble("altitudeM"),
                    horizontalAccuracyM = o.getDouble("horizontalAccuracyM"),
                    speedMps = if (o.isNull("speedMps")) null else o.getDouble("speedMps"),
                    headingDeg = if (o.isNull("headingDeg")) null else o.getDouble("headingDeg"),
                    source = o.optString("source", "fused"),
                    confidence = if (!o.has("confidence") || o.isNull("confidence")) null else o.getDouble("confidence"),
                    deadReckoned = if (!o.has("deadReckoned") || o.isNull("deadReckoned")) null else o.getBoolean("deadReckoned"),
                    barometricAltitudeM = if (!o.has("barometricAltitudeM") || o.isNull("barometricAltitudeM")) null else o.getDouble("barometricAltitudeM"),
                    authoritative = if (!o.has("authoritative") || o.isNull("authoritative")) null else o.getBoolean("authoritative"),
                    anchorSeq = if (!o.has("anchorSeq") || o.isNull("anchorSeq")) null else o.getLong("anchorSeq"),
                    estimatedUncertaintyM = if (!o.has("estimatedUncertaintyM") || o.isNull("estimatedUncertaintyM")) null else o.getDouble("estimatedUncertaintyM")
                )
            }
        }
        return out
    }

    @Synchronized
    fun acknowledge(throughSeq: Long) {
        writableDatabase.delete("location_queue", "seq <= ?", arrayOf(throughSeq.toString()))
    }
}
