package ai.lokin.location

data class LokinLocationSample(
    val seq: Long,
    val timestampMs: Long,
    val latitude: Double,
    val longitude: Double,
    val altitudeM: Double?,
    val horizontalAccuracyM: Double,
    val speedMps: Double?,
    val headingDeg: Double?,
    val source: String = "fused",
    val confidence: Double? = null,
    val deadReckoned: Boolean? = null,
    val barometricAltitudeM: Double? = null,
    val authoritative: Boolean? = null,
    val anchorSeq: Long? = null,
    val estimatedUncertaintyM: Double? = null
)

enum class LokinTrackingMode(val wireValue: String) {
    STOPPED("stopped"),
    PASSIVE("passive"),
    ACTIVE_NAVIGATION("activeNavigation");

    companion object {
        fun fromWire(value: String?): LokinTrackingMode = entries.firstOrNull { it.wireValue == value } ?: ACTIVE_NAVIGATION
    }
}
