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
    /** N7-FIX-01: every ring refused for its own walls overlapping, with the way back to its reading; absent from an older analyzer. */
    val ringCollisions: List<RingCollision> = emptyList(),
    /** N7-COUNCIL-FIX-03: bodies the plan draws walled that the model does not build, with the cause; absent from an older analyzer. */
    val missingBodies: List<MissingBody> = emptyList(),
)

/** N7-COUNCIL-FIX-03: a drawn body the model lost, as the analyzer weighed it: where, how large, and the step that lost it. */
@Serializable
data class MissingBody(
    val id: String = "",
    val rectM: MissingBodyRect = MissingBodyRect(),
    val areaM2: Double = 0.0,
    val coveredM2: Double = 0.0,
    val walled: Double = 0.0,
    val cause: String? = null,
    val why: String = "",
)

@Serializable
data class MissingBodyRect(val x0: Double = 0.0, val z0: Double = 0.0, val x1: Double = 0.0, val z1: Double = 0.0)

/**
 * N7-FIX-01: a ring the model refused for its own two walls overlapping, as the analyzer traced it — whether its thin-body
 * pass read the body, the body's width against its walls, the decision and why, whether the wall reconciliation moved
 * the ring before the refusal, and whether the partial preview took the body out. Shown, never interpreted.
 */
@Serializable
data class RingCollision(
    val ringId: String = "",
    /** N7-COUNCIL-FIX-02: OWN_WALLS (w1/w3 of the ring itself) or BETWEEN_BODIES (a narrowing the reconciliation refused). */
    val kind: String = "OWN_WALLS",
    val narrowing: RingNarrowing? = null,
    /** N7-COUNCIL-FIX-02: what the check before emission took the ring's rectangle for. */
    val preEmit: RingPreEmit? = null,
    val walls: List<String> = emptyList(),
    val overlapM2: Double? = null,
    val massId: String? = null,
    val selectedByThinBodies: Boolean = false,
    val notSelectedBecause: String? = null,
    val widthM: Double? = null,
    val lengthM: Double? = null,
    val wallThicknessM: Double? = null,
    val houseWallThicknessM: Double = 0.0,
    val farFaceInk: FarFaceInk? = null,
    val hypotheses: List<RingHypothesis> = emptyList(),
    val decision: RingDecision? = null,
    val firstBad: String? = null,
    val reconciliation: RingReconciliation = RingReconciliation(),
    val removedByPartialPreview: Boolean = false,
    val why: String = "",
)

@Serializable
data class RingNarrowing(val beforeM: Double = 0.0, val afterM: Double = 0.0, val minM: Double = 0.0, val otherWallId: String = "")

@Serializable
data class RingPreEmit(val kind: String = "", val verdict: String = "", val why: String = "")

@Serializable
data class FarFaceInk(val beforeOpenings: Double = 0.0, val afterOpenings: Double? = null, val openings: Int? = null, val wallWithOpenings: Boolean? = null)

@Serializable
data class RingHypothesis(val kind: String = "", val status: String = "", val why: String = "")

@Serializable
data class RingDecision(val kind: String = "", val why: String = "")

@Serializable
data class RingReconciliation(val changedGeometry: Boolean = false, val records: List<RingRepair> = emptyList())

@Serializable
data class RingRepair(val attempt: Int = 0, val action: String = "", val moveM: Double = 0.0, val why: String = "")

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
