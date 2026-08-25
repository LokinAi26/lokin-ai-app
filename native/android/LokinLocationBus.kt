package ai.lokin.location

import java.util.concurrent.CopyOnWriteArraySet

object LokinLocationBus {
    private val listeners = CopyOnWriteArraySet<(LokinLocationSample) -> Unit>()

    fun add(listener: (LokinLocationSample) -> Unit) { listeners += listener }
    fun remove(listener: (LokinLocationSample) -> Unit) { listeners -= listener }
    fun publish(sample: LokinLocationSample) { listeners.forEach { it(sample) } }
}
