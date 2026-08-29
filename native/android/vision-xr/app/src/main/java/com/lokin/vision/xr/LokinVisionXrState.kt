package com.lokin.vision.xr

import java.util.concurrent.CopyOnWriteArraySet

internal data class VisionXrSnapshot(
    val projectedConnected: Boolean = false,
    val projectedState: String = "waiting_device",
    val lastError: String? = null,
    val updatedAtMs: Long = System.currentTimeMillis()
)

internal object LokinVisionXrState {
    private val listeners = CopyOnWriteArraySet<(VisionXrSnapshot) -> Unit>()

    @Volatile
    private var snapshot = VisionXrSnapshot()

    fun current(): VisionXrSnapshot = snapshot

    fun update(
        projectedConnected: Boolean,
        projectedState: String,
        lastError: String? = null
    ) {
        val next = VisionXrSnapshot(
            projectedConnected = projectedConnected,
            projectedState = projectedState,
            lastError = lastError,
            updatedAtMs = System.currentTimeMillis()
        )
        snapshot = next
        listeners.forEach { listener -> runCatching { listener(next) } }
    }

    fun addListener(listener: (VisionXrSnapshot) -> Unit) {
        listeners.add(listener)
        listener(snapshot)
    }

    fun removeListener(listener: (VisionXrSnapshot) -> Unit) {
        listeners.remove(listener)
    }
}
