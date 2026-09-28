package com.buildplan.preview.progress

import kotlin.math.floor

/**
 * "Postęp wg etapów": progress by configured stages, and nothing else.
 *
 *     sum(weight × completion) / sum(weight)
 *
 * DONE counts 1, NOT_STARTED 0, IN_PROGRESS whatever the owner set. It is
 * not a share of money spent and not a share of the value of the work: the
 * starter stages weigh the same because nothing validated says otherwise.
 * Every screen that shows the figure takes it from here, so Dom, 3D and
 * Etapy can never disagree.
 */
object StageProgressMetric {
    /** The overall fraction, 0..1. */
    fun fraction(state: ConstructionProgressState): Double {
        val total = state.stages.sumOf { it.weight }
        val done = state.stages.sumOf { it.weight * it.completion }
        return (done / total).coerceIn(0.0, 1.0)
    }

    /**
     * Whole percent for display, rounded DOWN: a figure never claims more
     * than was stated, and 100 appears only when every stage is done.
     */
    fun percent(state: ConstructionProgressState): Int = percentOf(fraction(state))

    fun percentOf(fraction: Double): Int {
        require(fraction.isFinite() && fraction in 0.0..1.0) { "a progress fraction is within 0..1, not $fraction" }
        return if (fraction >= 1.0) 100 else floor(fraction * 100.0).toInt().coerceIn(0, 99)
    }

    /** The one text form of a percentage: "43%". Locale-free digits. */
    fun format(percent: Int): String {
        require(percent in 0..100) { "a percentage is within 0..100, not $percent" }
        return "$percent%"
    }
}
