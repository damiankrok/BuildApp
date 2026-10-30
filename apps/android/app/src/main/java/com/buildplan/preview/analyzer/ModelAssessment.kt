package com.buildplan.preview.analyzer

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * N9-01: the model on three axes the service keeps apart (`assessment`, `packages/analysis-service/src/assessment/types.ts`).
 *
 *   technicalValidity          the delivered model is valid and compiles — about the model alone
 *   decompositionCompleteness  how much of the analyzer's OWN reading the model holds — not agreement with the drawings
 *   sourceFidelity             relations between the model and the drawings: PASS, CONFLICT or UNCHECKED, each named
 *   sourceUnchecked            every sheet, storey and registration axis no relation compared
 *
 * The phone shows what the service said and derives nothing: UNCHECKED is never shown as a pass, and a CONFLICT never
 * hides or disables the 3D model. Absent from an analyzer older than service 1.3.0.
 */
@Serializable
data class ModelAssessment(
    val schema: String = "",
    val schemaVersion: String = "",
    val technicalValidity: TechnicalValidity = TechnicalValidity(),
    val decompositionCompleteness: DecompositionCompleteness = DecompositionCompleteness(),
    val sourceFidelity: SourceFidelity = SourceFidelity(),
    val sourceUnchecked: SourceUnchecked = SourceUnchecked(),
    val previewAvailable: Boolean = true,
    /** N9-02A: every elevation on four axes; absent from a service older than 1.4.0. */
    val elevationRegistration: ElevationRegistration? = null,
    val summary: String = "",
) {
    val hasConflicts: Boolean get() = sourceFidelity.status == CONFLICT
    val hasTechnicalErrors: Boolean get() = technicalValidity.status == ERRORS

    companion object {
        const val PASS = "PASS"
        const val CONFLICT = "CONFLICT"
        const val UNCHECKED = "UNCHECKED"
        const val VALID = "VALID"
        const val ERRORS = "ERRORS"
    }
}

@Serializable
data class TechnicalValidity(
    val status: String = "",
    val errors: Int = 0,
    val warnings: Int = 0,
    val checks: List<TechnicalCheck> = emptyList(),
    val note: String = "",
)

@Serializable
data class TechnicalCheck(
    val check: String = "",
    val errors: Int = 0,
    val warnings: Int = 0,
    val findings: List<TechnicalFinding> = emptyList(),
    val note: String? = null,
)

@Serializable
data class TechnicalFinding(val code: String = "", val severity: String = "", val auditSeverity: String? = null, val objectId: String? = null, val message: String = "")

@Serializable
data class DecompositionCompleteness(val verdict: String = "", val basis: String = "", val meaning: String = "")

@Serializable
data class StatusCounts(
    @SerialName("PASS") val pass: Int = 0,
    @SerialName("CONFLICT") val conflict: Int = 0,
    @SerialName("UNCHECKED") val unchecked: Int = 0,
)

@Serializable
data class SourceFidelity(
    val status: String = "",
    val relations: List<FidelityRelation> = emptyList(),
    val counts: StatusCounts = StatusCounts(),
    val conflicts: List<String> = emptyList(),
    val meaning: String = "",
)

@Serializable
data class FidelityRelation(
    val id: String = "",
    val title: String = "",
    val direction: String = "",
    val status: String = "",
    val counts: StatusCounts = StatusCounts(),
    val items: List<FidelityItem> = emptyList(),
    val limits: List<String> = emptyList(),
)

/** One compared object; its measured values stay on the server's record (they are a mix of numbers and words). */
@Serializable
data class FidelityItem(
    val status: String = "",
    val objects: List<String> = emptyList(),
    val source: FidelitySource? = null,
    val code: String = "",
    val why: String = "",
    val evidence: List<String> = emptyList(),
)

@Serializable
data class FidelitySource(val frameId: String = "", val assetId: String? = null, val document: String = "", val storeyIndex: Int? = null, val side: String? = null)

@Serializable
data class SourceUnchecked(val items: List<UncheckedItem> = emptyList(), val counts: UncheckedCounts = UncheckedCounts())

@Serializable
data class UncheckedCounts(val total: Int = 0, val byKind: Map<String, Int> = emptyMap(), val none: Int = 0, val partial: Int = 0)

@Serializable
data class UncheckedItem(
    val kind: String = "",
    /** N9-02A: for an elevation, how far its registration reaches on each axis. */
    val registration: ViewAxesSummary? = null,
    val frameId: String? = null,
    val storeyIndex: Int? = null,
    val side: String? = null,
    val extent: String = "",
    val what: String = "",
    val why: String = "",
    val couldCheck: String = "",
)

/** N9-02A: one elevation's registration, axis by axis: FULL / ALONG_ONLY / VERTICAL_ONLY / UNREGISTERED. */
@Serializable
data class ViewAxesSummary(val `class`: String = "", val side: String = "", val along: String = "", val vertical: String = "", val scale: String = "")

@Serializable
data class RegistrationCounts(
    @SerialName("FULL") val full: Int = 0,
    @SerialName("ALONG_ONLY") val alongOnly: Int = 0,
    @SerialName("VERTICAL_ONLY") val verticalOnly: Int = 0,
    @SerialName("UNREGISTERED") val unregistered: Int = 0,
)

@Serializable
data class RegistrationBeforeAfter(val before: RegistrationCounts = RegistrationCounts(), val after: RegistrationCounts = RegistrationCounts())

/** The per-view records stay on the server's answer; the phone reads the counts and what each unchecked view lacks. */
@Serializable
data class ElevationRegistration(val counts: RegistrationBeforeAfter = RegistrationBeforeAfter())
