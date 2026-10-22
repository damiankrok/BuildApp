package com.buildplan.preview.scene

import kotlinx.serialization.Serializable

/**
 * N7-P1: whether an analysed model is the whole reading or the last valid part of it, as the analyzer reported it
 * (`preview` in `LinkAnalysisSummary`, `packages/analysis-service/src/preview.ts`).
 *
 * Kept with the stored scene, so the 3D screen can say beside the model what was built, what is missing, which object
 * the model refused, and which numbers are only for viewing — however long after the analysis it is opened. The phone
 * shows these facts; it never derives one. An analyzer from before N7-P1 sends none, and its result reads as complete.
 */
@Serializable
data class PreviewOutcome(
    /** `COMPLETE` or `PARTIAL_3D_PREVIEW`. */
    val outcome: String = COMPLETE,
    val built: PreviewBuilt = PreviewBuilt(),
    val provisional: List<ProvisionalValue> = emptyList(),
    val partial: PartialPreview? = null,
) {
    /** A model the analyzer delivered as the last valid part of the house, never as a complete reconstruction. */
    val isPartial: Boolean get() = outcome == PARTIAL_3D_PREVIEW && partial != null

    companion object {
        const val COMPLETE = "COMPLETE"
        const val PARTIAL_3D_PREVIEW = "PARTIAL_3D_PREVIEW"
    }
}

/** What the model holds, counted by the analyzer off the model it sealed. */
@Serializable
data class PreviewBuilt(
    val wallRings: Int = 0,
    val walls: Int = 0,
    val slabs: Int = 0,
    val roofs: Int = 0,
    val roofPlanes: Int = 0,
    val openings: Int = 0,
    val rooms: Int = 0,
    val stairs: Int = 0,
)

/** A number drawn for viewing only: `HEIGHT_ASSUMED_FOR_PREVIEW`, `SCALE_NOT_VERIFIED`, `APPROXIMATE_ROOF_DATUM`. */
@Serializable
data class ProvisionalValue(val code: String = "", val what: String = "")

@Serializable
data class PartialPreview(
    /** `CHECKPOINT`: everything but the refused objects; `MINIMAL_BASE`: the main body's floors and walls alone. */
    val basis: String = "",
    /** The refusal the run met first. */
    val failure: PreviewFailure = PreviewFailure(),
    val failures: List<PreviewFailure> = emptyList(),
    /** The objects the preview does not build. */
    val missing: List<PreviewMissing> = emptyList(),
    val checkpoint: PreviewCheckpoint? = null,
)

@Serializable
data class PreviewFailure(
    val commandIndex: Int = -1,
    val type: String = "",
    val id: String? = null,
    val codes: List<String> = emptyList(),
    /** The validator's own sentence. */
    val message: String = "",
    val objectIds: List<String> = emptyList(),
)

@Serializable
data class PreviewMissing(val type: String = "", val id: String? = null, val cause: String = "", val why: String = "")

/** The base the preview keeps: the program prefix up to the main body's last floor or walls, and its model's hash. */
@Serializable
data class PreviewCheckpoint(
    val commands: Int = 0,
    val modelSha256: String = "",
    val wallRings: List<String> = emptyList(),
    val slabs: List<String> = emptyList(),
)
