package com.buildplan.preview.analyzer

import kotlinx.serialization.Serializable

/**
 * v3.53.8: what the delivered model may be measured for, kept apart from whether the run finished. `run` is the run's
 * technical outcome (always COMPLETED when a model is delivered); coverage holds the lowest storey against the
 * footprint the publisher prints, scale holds the built scale against the plan's own printed dimensions, and
 * `quantities` says what follows for areas and lengths taken off the model. Every verdict short of usable carries its
 * reasons, each with its consequence. Absent from an analyzer older than service 1.11.0.
 */
@Serializable
data class MeasurementAssessment(
    val schemaVersion: String = "",
    val run: String = "COMPLETED",
    val coverage: Coverage = Coverage(),
    val scale: Scale = Scale(),
    val completeness: String = "",
    val quantities: String = NOT_ASSESSED,
    val reasons: List<Reason> = emptyList(),
) {
    @Serializable
    data class Coverage(val status: String = NOT_ASSESSED, val builtM2: Double = 0.0, val publishedM2: Double? = null, val share: Double? = null)

    @Serializable
    data class Scale(val status: String = NOT_ASSESSED, val builtCmPerPx: Double? = null, val measuredCmPerPx: Double? = null, val ratio: Double? = null, val confidence: String? = null)

    @Serializable
    data class Reason(val code: String = "", val consequence: String = "")

    companion object {
        const val USABLE_IN_SCOPE = "USABLE_IN_SCOPE"
        const val LIMITED = "LIMITED"
        const val NOT_USABLE = "NOT_USABLE"
        const val NOT_ASSESSED = "NOT_ASSESSED"
    }
}
